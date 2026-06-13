# COLLECT_PROJECT.ps1
$outputFile = "ORION_DNA.txt"
$filesToInclude = @("*.py", "*.html", "*.css", "*.js", "*.bat", "README.md")
$excludeFolders = @("venv", ".git", "__pycache__", "runtime", "logs")

"--- AR10 ORION PROJECT DNA ---`n" | Out-File $outputFile

Get-ChildItem -Recurse -Include $filesToInclude | Where-Object { 
    $filePath = $_.FullName
    $shouldExclude = $false
    foreach ($folder in $excludeFolders) {
        if ($filePath -like "*\$folder\*") { $shouldExclude = $true; break }
    }
    -not $shouldExclude
} | ForEach-Object {
    "--- START OF FILE: $($_.RelativeName) ---" | Out-File $outputFile -Append
    Get-Content $_.FullName | Out-File $outputFile -Append
    "--- END OF FILE ---`n" | Out-File $outputFile -Append
}

Write-Host "DNA Collected in $outputFile. Please upload this file or copy its content here." -ForegroundColor Cyan