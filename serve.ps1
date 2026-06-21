#Requires -Version 5
<#
.SYNOPSIS
    Minimal static file server for local development of 3D-OS.

.DESCRIPTION
    Serves this folder over HTTP using System.Net.HttpListener, so no Node or
    Python is required. The page MUST be served over HTTP — ES modules and the
    THREE.js CDN import map do not work from a file:// URL.

.PARAMETER Port
    TCP port to listen on (default 8000).

.PARAMETER Root
    Folder to serve (default: the folder containing this script).

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\serve.ps1
    # then open http://localhost:8000/  (Ctrl+C to stop)

.EXAMPLE
    .\serve.ps1 -Port 9000
#>
param(
    [int]$Port = 8000,
    [string]$Root = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'

$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
}

$rootFull = [System.IO.Path]::GetFullPath($Root)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "3D-OS dev server -> http://localhost:$Port/  (serving $rootFull)"
Write-Host 'Press Ctrl+C to stop.'

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        try {
            $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
            if ([string]::IsNullOrEmpty($rel)) { $rel = 'index.html' }

            $path = [System.IO.Path]::GetFullPath((Join-Path $rootFull $rel))

            # Stay inside the served folder (basic path-traversal guard).
            if (-not $path.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
                $ctx.Response.StatusCode = 403
            }
            elseif (Test-Path -LiteralPath $path -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($path)
                $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
                if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] }
                else { $ctx.Response.ContentType = 'application/octet-stream' }
                $ctx.Response.StatusCode = 200
                $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            else {
                $ctx.Response.StatusCode = 404
            }
        }
        catch {
            $ctx.Response.StatusCode = 500
        }
        finally {
            $ctx.Response.Close()
        }
    }
}
finally {
    $listener.Stop()
}
