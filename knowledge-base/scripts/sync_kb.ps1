<#
.SYNOPSIS
    Sincroniza os 3 PDFs oficiais e seus arquivos .metadata.json com o bucket S3 do ImobiSmart AI
    e (opcionalmente) dispara o StartIngestionJob na Bedrock Knowledge Base.

.EXAMPLE
    .\knowledge-base\scripts\sync_kb.ps1 -BucketName "imobismart-kb-docs-123456789012"
    .\knowledge-base\scripts\sync_kb.ps1 -BucketName "imobismart-kb-docs-123456789012" -KnowledgeBaseId "ABCD1234" -DataSourceId "EFGH5678"
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$BucketName,

    [string]$Prefix = "documents",
    [string]$Region = "us-east-1",
    [string]$KnowledgeBaseId = "",
    [string]$DataSourceId = ""
)

$ErrorActionPreference = "Stop"
$docsDir = Join-Path $PSScriptRoot "..\documents"

if (-not (Test-Path -LiteralPath $docsDir)) {
    throw "Diretorio de documentos nao encontrado: $docsDir"
}

Write-Host "==> Sincronizando '$docsDir' para s3://$BucketName/$Prefix/ (--delete remove arquivos obsoletos)..." -ForegroundColor Cyan
aws s3 sync $docsDir "s3://$BucketName/$Prefix/" `
    --delete `
    --region $Region `
    --exclude "*" `
    --include "*.pdf" `
    --include "*.metadata.json"

Write-Host "`n==> Conteudo atual no S3:" -ForegroundColor Green
aws s3 ls "s3://$BucketName/$Prefix/" --human-readable --summarize

if ($KnowledgeBaseId -and $DataSourceId) {
    Write-Host "`n==> Disparando sincronizacao (Ingestion Job) na Bedrock Knowledge Base..." -ForegroundColor Cyan
    aws bedrock-agent start-ingestion-job `
        --knowledge-base-id $KnowledgeBaseId `
        --data-source-id $DataSourceId `
        --region $Region
} else {
    Write-Host "`n[Info] KnowledgeBaseId/DataSourceId nao informados — apenas upload no S3 concluido." -ForegroundColor Yellow
}
