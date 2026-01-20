$env:NODE_ENV="development"
Get-Content .env | Where-Object { $_ -match '^[A-Za-z_][A-Za-z0-9_]*=' } | ForEach-Object { $parts = $_ -split '=',2; Set-Item -Path ("Env:" + $parts[0]) -Value $parts[1] }
Set-Location "D:\AntiGrav Scan2Plan\Scan2Plan-Sales-Production"
& "node_modules\.bin\tsx.cmd" "server/index.ts"
