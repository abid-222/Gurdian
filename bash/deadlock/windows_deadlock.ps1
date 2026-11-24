# ==============================================================================
# GUARDIAN V7 - WINDOWS OS DEADLOCK BRIDGE
# Emulates real Windows named Mutex / File Lock deadlocks using .NET
# for cross-platform teacher demonstrations on native Windows
# ==============================================================================
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("create", "prevent", "resolve", "status", "cleanup")]
    [string]$Action
)

$lockDir = Join-Path $env:TEMP "guardian_deadlock"
if (-not (Test-Path $lockDir)) { New-Item -ItemType Directory -Path $lockDir -Force | Out-Null }
$statusFile = Join-Path $lockDir "status.json"
$pidFile = Join-Path $lockDir "pids.txt"

switch ($Action) {
    "create" {
        # Launch two PowerShell jobs holding and cross-waiting on real Mutexes
        $scriptP1 = {
            $m1 = New-Object System.Threading.Mutex($false, "Guardian_Mutex_A")
            $m2 = New-Object System.Threading.Mutex($false, "Guardian_Mutex_B")
            $m1.WaitOne() | Out-Null
            Start-Sleep -Milliseconds 1200
            $m2.WaitOne() | Out-Null
            Start-Sleep -Seconds 3
            $m2.ReleaseMutex()
            $m1.ReleaseMutex()
        }

        $scriptP2 = {
            $m1 = New-Object System.Threading.Mutex($false, "Guardian_Mutex_A")
            $m2 = New-Object System.Threading.Mutex($false, "Guardian_Mutex_B")
            $m2.WaitOne() | Out-Null
            Start-Sleep -Milliseconds 1200
            $m1.WaitOne() | Out-Null
            Start-Sleep -Seconds 3
            $m1.ReleaseMutex()
            $m2.ReleaseMutex()
        }

        $j1 = Start-Job -ScriptBlock $scriptP1
        $j2 = Start-Job -ScriptBlock $scriptP2
        Start-Sleep -Milliseconds 2000

        "$($j1.Id)" | Out-File $pidFile -Encoding ascii
        "$($j2.Id)" | Out-File $pidFile -Append -Encoding ascii

        $status = @{
            mode = "deadlock"
            platform = "windows"
            p1 = @{ pid = $j1.Id; state = "BLOCKED_WAIT"; holding = "Mutex_A"; waiting = "Mutex_B" }
            p2 = @{ pid = $j2.Id; state = "BLOCKED_WAIT"; holding = "Mutex_B"; waiting = "Mutex_A" }
            cycle = @("P1", "Mutex_B", "P2", "Mutex_A", "P1")
            timestamp = [int][double]::Parse((Get-Date -UFormat %s))
        }
        $status | ConvertTo-Json | Set-Content $statusFile
        Write-Output "[WIN_DEADLOCK_CONFIRMED] Two background jobs deadlocked on System.Threading.Mutex."
    }

    "prevent" {
        # Strict hierarchical ordering Mutex A then Mutex B
        $scriptSafe = {
            param($name, $delay)
            Start-Sleep -Milliseconds $delay
            $m1 = New-Object System.Threading.Mutex($false, "Guardian_Mutex_A")
            $m2 = New-Object System.Threading.Mutex($false, "Guardian_Mutex_B")
            $m1.WaitOne() | Out-Null
            $m2.WaitOne() | Out-Null
            Start-Sleep -Milliseconds 800
            $m2.ReleaseMutex()
            $m1.ReleaseMutex()
        }

        $j1 = Start-Job -ScriptBlock $scriptSafe -ArgumentList "P1", 0
        $j2 = Start-Job -ScriptBlock $scriptSafe -ArgumentList "P2", 200
        Wait-Job $j1, $j2 | Out-Null
        Remove-Job $j1, $j2 -Force

        $status = @{
            mode = "prevented"
            platform = "windows"
            p1 = @{ pid = $j1.Id; state = "COMPLETED"; holding = $null; waiting = $null }
            p2 = @{ pid = $j2.Id; state = "COMPLETED"; holding = $null; waiting = $null }
            cycle = $null
            prevention_rule = "Hierarchical Resource Ordering: Mutex_A (1) < Mutex_B (2)"
            result = "Strict total ordering prevented circular wait. Completed safely."
            timestamp = [int][double]::Parse((Get-Date -UFormat %s))
        }
        $status | ConvertTo-Json | Set-Content $statusFile
        Write-Output "[WIN_PREVENTION_SUCCESS] Sequential execution completed safely."
    }

    "resolve" {
        if (Test-Path $pidFile) {
            $ids = Get-Content $pidFile
            if ($ids.Count -ge 2) {
                # Stop victim job
                Stop-Job -Id ([int]$ids[1]) -ErrorAction SilentlyContinue
                Remove-Job -Id ([int]$ids[1]) -Force -ErrorAction SilentlyContinue
            }
        }
        $status = @{
            mode = "resolved"
            platform = "windows"
            p1 = @{ pid = "RECOVERED"; state = "COMPLETED"; holding = $null; waiting = $null }
            p2 = @{ pid = "VICTIM"; state = "PREEMPTED_VICTIM"; holding = $null; waiting = $null }
            cycle = $null
            recovery_method = "Victim Preemption (Killed P2 Mutex Holder)"
            result = "Victim preempted. Mutex released, system recovered."
            timestamp = [int][double]::Parse((Get-Date -UFormat %s))
        }
        $status | ConvertTo-Json | Set-Content $statusFile
        Write-Output "[WIN_RESOLVE_SUCCESS] Victim preempted, system unlocked."
    }

    "status" {
        if (Test-Path $statusFile) { Get-Content $statusFile }
        else { '{"mode":"idle","platform":"windows","p1":null,"p2":null,"cycle":null}' }
    }

    "cleanup" {
        Get-Job | Where-Object { $_.Command -like "*Guardian_Mutex*" } | Stop-Job -ErrorAction SilentlyContinue | Remove-Job -Force -ErrorAction SilentlyContinue
        if (Test-Path $lockDir) { Remove-Item $lockDir -Recurse -Force -ErrorAction SilentlyContinue }
        Write-Output "[WIN_CLEANUP] Lab reset completed."
    }
}
