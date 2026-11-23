"""Risk rules as DATA. Detection logic for each id lives in engine.py."""
RULES = [
 dict(id="brute_force", module="auth", points=30, severity="HIGH", reference="T1110", message="{count} failed logins from {ip} within 10 min"),
 dict(id="file_changed", module="integrity", points=40, severity="HIGH", reference="File integrity violation", message="Watched file changed: {path}"),
 dict(id="new_cron_service", module="persistence", points=30, severity="HIGH", reference="T1053.003, T1543.002", message="New {type} entry (Linux): {location}"),
 dict(id="new_run_key", module="persistence", points=30, severity="HIGH", reference="T1547.001, T1053.005", message="New {type} entry (Windows): {location}"),
 dict(id="new_ssh_key", module="persistence", points=30, severity="HIGH", reference="T1098.004", message="New SSH authorized key: {location}"),
 dict(id="deleted_binary", module="process", points=25, severity="HIGH", reference="Suspicious execution", message="Process {name} (pid {pid}) runs from a deleted binary"),
 dict(id="tmp_exec", module="process", points=20, severity="MEDIUM", reference="Suspicious location", message="Process {name} (pid {pid}) runs from {exe_path}"),
 dict(id="new_listening_port", module="network", points=20, severity="MEDIUM", reference="T1571", message="New listening port {local_port}/{proto} ({process})"),
 dict(id="new_usb", module="usb", points=10, severity="LOW", reference="T1200", message="New USB device: {name}"),
 dict(id="high_resource", module="system", points=10, severity="LOW", reference="Resource abuse", message="CPU or RAM above 90% for 10 s ({source})"),
dict(id="login_after_bruteforce", module="auth", points=40, severity="HIGH", reference="T1110, T1078", message="Successful login by {user} from {ip} after {count} failed attempts"),
 dict(id="sudo_su_use", module="auth", points=10, severity="LOW", reference="T1548.003", message="{method} used by {username}"),
 dict(id="new_user_account", module="persistence", points=30, severity="HIGH", reference="T1136.001", message="New or modified user account ({source}): {location}"),
 dict(id="new_suid_file", module="persistence", points=30, severity="HIGH", reference="T1548.001", message="New SUID file: {location}"),
 dict(id="new_world_writable", module="persistence", points=20, severity="MEDIUM", reference="T1222.002", message="New world-writable file: {location}"),
 dict(id="shell_profile_changed", module="persistence", points=30, severity="HIGH", reference="T1546.004", message="Shell startup file changed: {location}"),
 dict(id="hosts_file_changed", module="integrity", points=40, severity="HIGH", reference="T1565.001", message="Hosts file changed: {path}"),
 dict(id="new_process", module="process", points=10, severity="LOW", reference="Baseline deviation", message="{count} new process name(s) since baseline: {names}"),
 dict(id="unusual_external_ip", module="network", points=20, severity="MEDIUM", reference="T1071", message="Connection to unusual external IP {remote_addr} by {process} ({source})"),
]
LEVELS = [(60, "CRITICAL"), (30, "WARNING"), (0, "SAFE")]
