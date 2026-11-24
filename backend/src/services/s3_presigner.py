"""Safe S3 Pre-signed URL generator restricted strictly to the KB documents prefix."""

from __future__ import annotations

from urllib.parse import unquote

import boto3
from botocore.config import Config


class S3Presigner:
    """Generates short-lived inline PDF Pre-signed URLs for cited S3 objects."""

    def __init__(
        self,
        bucket_name: str,
        allowed_prefix: str = "documents/",
        expires_seconds: int = 600,
        region_name: str = "us-east-1",
        s3_client=None,
    ) -> None:
        self.bucket_name = bucket_name
        self.allowed_prefix = allowed_prefix.lstrip("/")
        if self.allowed_prefix and not self.allowed_prefix.endswith("/"):
            self.allowed_prefix += "/"
        self.expires_seconds = max(60, min(int(expires_seconds), 3600))
        self._client = s3_client or boto3.client(
            "s3",
            region_name=region_name,
            config=Config(signature_version="s3v4"),
        )

    def parse_s3_uri(self, s3_uri: str) -> tuple[str, str] | None:
        if not s3_uri or not s3_uri.startswith("s3://"):
            return None
        path = s3_uri[len("s3://") :]
        bucket, _, raw_key = path.partition("/")
        key = unquote(raw_key).lstrip("/")
        if not bucket or not key:
            return None
        return bucket, key

    def presign_document_uri(self, s3_uri: str) -> tuple[str | None, str | None]:
        """Return (presigned_url, s3_key) if URI belongs to the allowed bucket/prefix."""
        parsed = self.parse_s3_uri(s3_uri)
        if not parsed:
            return None, None

        bucket, key = parsed
        # Strict security guard: only sign objects inside the exact KB bucket & prefix, no traversal
        if bucket != self.bucket_name:
            return None, None
        if not key.startswith(self.allowed_prefix):
            return None, None
        if ".." in key.split("/"):
            return None, None

        params = {
            "Bucket": bucket,
            "Key": key,
            "ResponseContentDisposition": "inline",
        }
        if key.lower().endswith(".pdf"):
            params["ResponseContentType"] = "application/pdf"

        url = self._client.generate_presigned_url(
            ClientMethod="get_object",
            Params=params,
            ExpiresIn=self.expires_seconds,
        )
        return url, key
