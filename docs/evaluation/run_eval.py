"""Automated Golden Dataset evaluation runner for ImobiSmart AI RAG + Guardrails."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import unicodedata
from pathlib import Path

import requests

API_BASE_URL = os.environ.get("AWS_API_BASE_URL", "").rstrip("/")
API_KEY = os.environ.get("AWS_API_KEY", "").strip()
API_KEY_ID = os.environ.get("AWS_API_KEY_ID", "").strip()
AWS_PROFILE = os.environ.get("AWS_PROFILE", "imobismart")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")


def normalize(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(ch for ch in nfkd if not unicodedata.combining(ch))


def get_api_key() -> str:
    if API_KEY:
        return API_KEY
    if not API_KEY_ID:
        raise RuntimeError(
            "Defina AWS_API_KEY ou AWS_API_KEY_ID (e AWS_API_BASE_URL) antes de executar run_eval.py."
        )
    return (
        subprocess.check_output(
            [
                "aws",
                "apigateway",
                "get-api-key",
                "--api-key",
                API_KEY_ID,
                "--include-value",
                "--region",
                AWS_REGION,
                "--profile",
                AWS_PROFILE,
                "--query",
                "value",
                "--output",
                "text",
            ]
        )
        .decode()
        .strip()
    )


def main() -> int:
    if not API_BASE_URL:
        raise RuntimeError("Defina a variavel de ambiente AWS_API_BASE_URL antes de executar run_eval.py.")
    dataset_path = Path(__file__).parent / "golden_dataset.json"
    cases = json.loads(dataset_path.read_text(encoding="utf-8"))
    api_key = get_api_key()

    passed = 0
    total_latency = 0
    results: list[dict] = []

    print(f"Executando {len(cases)} casos do Golden Dataset contra {API_BASE_URL}/v1/chat...\n")
    for idx, case in enumerate(cases):
        if idx > 0:
            time.sleep(6)  # Avoid Bedrock/Cohere Rerank RPM burst throttling during batch eval
        resp = requests.post(
            f"{API_BASE_URL}/v1/chat",
            headers={"x-api-key": api_key, "Content-Type": "application/json"},
            json={"prompt": case["prompt"], "persona": "corretor"},
            timeout=60,
        )
        data = resp.json() if resp.ok else {}
        answer = data.get("answer", "")
        guardrail = data.get("guardrail_action", "NONE")
        latency = int(data.get("latency_ms", 0))
        total_latency += latency
        cited_codes = {c.get("codigo_doc") for c in data.get("citations", [])}

        if case["expect_guardrail"]:
            ok = resp.status_code == 200 and guardrail == "INTERVENED"
            detail = f"guardrail={guardrail}"
        else:
            norm_answer = normalize(answer)
            missing_kw = [k for k in case["expected_keywords"] if normalize(k) not in norm_answer]
            missing_docs = [d for d in case["expected_docs"] if d not in cited_codes]
            ok = resp.status_code == 200 and not missing_kw and not missing_docs
            detail = (
                "OK"
                if ok
                else f"missing_kw={missing_kw} missing_docs={missing_docs} guardrail={guardrail}"
            )

        if ok:
            passed += 1
        status_icon = "PASS" if ok else "FAIL"
        print(f"[{status_icon}] {case['id']} ({case['category']}) | {latency}ms | {detail}")
        results.append(
            {
                "id": case["id"],
                "category": case["category"],
                "passed": ok,
                "latency_ms": latency,
                "cited_docs": sorted(c for c in cited_codes if c),
                "guardrail_action": guardrail,
                "detail": detail,
            }
        )

    rate = (passed / len(cases)) * 100
    avg_ms = int(total_latency / max(1, len(cases)))
    print(f"\n=== RESUMO: {passed}/{len(cases)} ({rate:.1f}%) | Latencia media: {avg_ms}ms ===")

    report_path = Path(__file__).parent / "last_eval_report.json"
    report_path.write_text(
        json.dumps(
            {
                "passed": passed,
                "total": len(cases),
                "pass_rate_pct": round(rate, 1),
                "avg_latency_ms": avg_ms,
                "results": results,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return 0 if rate >= 85.0 else 1


if __name__ == "__main__":
    sys.exit(main())
