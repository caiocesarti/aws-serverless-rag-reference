<#
.SYNOPSIS
    Empacota o backend Python (backend/src), sobe o artefato para s3://<bucket>/artifacts/,
    valida o template CloudFormation e faz o deploy completo da stack ImobiSmart AI.
#>
param(
    [string]$Profile = "imobismart",
    [string]$Region = "us-east-1",
    [string]$StackName = "imobismart-ai-prod",
    [string]$EnvironmentName = "prod",
    [Parameter(Mandatory = $true)]
    [string]$DocsBucketName,
    [Parameter(Mandatory = $true)]
    [string]$KnowledgeBaseId,
    [Parameter(Mandatory = $true)]
    [string]$GuardrailId,
    [string]$GuardrailVersion = "DRAFT",
    [string]$AllowedOrigins = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$buildDir = Join-Path $env:TEMP "imobismart-build"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$zipName = "imobismart-api-$timestamp.zip"
$zipPath = Join-Path $env:TEMP $zipName
$s3Key = "artifacts/$zipName"
$templatePath = Join-Path $PSScriptRoot "template.yaml"

Write-Host "==> 1. Executando testes unitarios antes do deploy (DevSecOps Shift-Left)..." -ForegroundColor Cyan
& (Join-Path $repoRoot "venv\Scripts\python.exe") -m unittest discover -s (Join-Path $backendDir "tests") -v
if ($LASTEXITCODE -ne 0) { throw "Testes unitarios falharam! Deploy abortado." }

Write-Host "`n==> 2. Empacotando backend/src em $zipPath..." -ForegroundColor Cyan
if (Test-Path $buildDir) { Remove-Item $buildDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
Copy-Item -Path (Join-Path $backendDir "src") -Destination (Join-Path $buildDir "src") -Recurse
Get-ChildItem -Path $buildDir -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $buildDir "src") -DestinationPath $zipPath -Force

Write-Host "==> 3. Enviando pacote Lambda para s3://$DocsBucketName/$s3Key (prefixo isolado de documents/)..." -ForegroundColor Cyan
aws s3 cp $zipPath "s3://$DocsBucketName/$s3Key" --region $Region --profile $Profile

Write-Host "`n==> 4. Validando template CloudFormation (infra/template.yaml)..." -ForegroundColor Cyan
aws cloudformation validate-template --template-body "file://$templatePath" --region $Region --profile $Profile | Out-Null
Write-Host "    Template valido!" -ForegroundColor Green

Write-Host "`n==> 5. Fazendo deploy da stack CloudFormation '$StackName'..." -ForegroundColor Cyan
aws cloudformation deploy `
    --template-file $templatePath `
    --stack-name $StackName `
    --region $Region `
    --profile $Profile `
    --capabilities CAPABILITY_NAMED_IAM `
    --no-fail-on-empty-changeset `
    --parameter-overrides `
        EnvironmentName=$EnvironmentName `
        DocsBucketName=$DocsBucketName `
        LambdaCodeS3Key=$s3Key `
        KnowledgeBaseId=$KnowledgeBaseId `
        GuardrailId=$GuardrailId `
        GuardrailVersion=$GuardrailVersion `
        AllowedOrigins=$AllowedOrigins

Write-Host "`n==> 6. Outputs da Stack:" -ForegroundColor Green
aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --profile $Profile `
    --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" `
    --output table

Remove-Item $buildDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
