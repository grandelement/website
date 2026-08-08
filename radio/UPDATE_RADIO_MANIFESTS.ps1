param([string]$RepoRoot = (Get-Location).Path)
$ErrorActionPreference = "Stop"
$musicRoot = Join-Path $RepoRoot "ge-music"
$musicFolder = Join-Path $musicRoot "music"
$clipsFolder = Join-Path $musicRoot "clips"
$radioFolder = Join-Path $RepoRoot "radio"
$imageBgFolder = Join-Path $RepoRoot "ge-images\img"
$extensions = @(".mp3",".m4a",".ogg",".wav")
$musicFiles = @()
foreach($root in @($clipsFolder,$musicFolder)){
  if(Test-Path $root){
    Get-ChildItem $root -Recurse -File | Where-Object {
      $extensions -contains $_.Extension.ToLower()
    } | ForEach-Object {
      $relative = $_.FullName.Substring($RepoRoot.Length).TrimStart("\") -replace "\\","/"
      $musicFiles += $relative
    }
  }
}
$musicFiles = $musicFiles | Sort-Object
$musicManifest = [ordered]@{
  name = "music manifest"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  owner = "grandelement"
  repo = "website"
  branch = "main"
  musicRoot = "ge-music/music"
  clipsRoot = "ge-music/clips"
  files = @($musicFiles)
}
$musicManifest | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $radioFolder "manifest.json") -Encoding UTF8
if(Test-Path $imageBgFolder){
  $imageFiles = Get-ChildItem $imageBgFolder -File | Where-Object {
    @(".gif",".png",".jpg",".jpeg",".webp") -contains $_.Extension.ToLower()
  } | Select-Object -ExpandProperty Name | Sort-Object
  $imageFiles | ConvertTo-Json | Set-Content (Join-Path $imageBgFolder "manifest.json") -Encoding UTF8
}
Write-Host ""
Write-Host "Grand Element manifests updated."
Write-Host "Commit/upload the changed manifests and new files, then press Reload Library."
