/**
 * Raw Glances payloads, captured verbatim from a live server on 2026-08-04.
 *
 * Source: `https://glances.tcloud.monster` — Glances **4.5.6**, a containerised Linux host with an
 * NVIDIA GPU, Docker containers and lm-sensors. Long arrays are trimmed to a representative head;
 * nothing else is edited, because the point of a fixture is to carry the quirks:
 *
 * - `network` and `diskio` items carry the full rate triple — `<field>_gauge`, the plain delta,
 *   and `<field>_rate_per_sec` — plus `time_since_update`. That three-variant shape is the whole
 *   reason rate resolution exists (ref §4.3).
 * - `fs` leads with bind mounts rather than real disks, because the server runs in a container.
 * - `sensors` repeats a label across types, which is why a sensor id has to be composite.
 * - `containers` reports `memory_percent: null` and an empty `network` block, so the nullable
 *   rate fields are nullable in practice and not only in theory.
 * - `gpu` is a single-entry list whose fields are vendor-dependent.
 * - `alert` is empty — the healthy-server case a feed still has to render.
 * - `uptime` is a bare preformatted string, not a number.
 *
 * Regenerate by fetching each plugin from a live 4.x server; do not hand-edit values.
 */

export const rawCpu = {
  "total": 3.5,
  "user": 1.7,
  "nice": 0,
  "system": 1.3,
  "idle": 96.2,
  "iowait": 0.3,
  "irq": 0,
  "steal": 0,
  "guest": 0,
  "ctx_switches": 31409,
  "interrupts": 13868,
  "soft_interrupts": 15185,
  "syscalls": 0,
  "cpucore": 12,
  "time_since_update": 2.0316126346588135,
  "ctx_switches_gauge": 33196183533,
  "ctx_switches_rate_per_sec": 15460,
  "interrupts_gauge": 13433198373,
  "interrupts_rate_per_sec": 6826,
  "soft_interrupts_gauge": 8759835688,
  "soft_interrupts_rate_per_sec": 7474,
  "syscalls_gauge": 0,
  "syscalls_rate_per_sec": 0
};

export const rawPercpu = [
  {
    "key": "cpu_number",
    "cpu_number": 0,
    "total": 2.3,
    "user": 1.2,
    "system": 1.2,
    "idle": 97.7,
    "nice": 0,
    "iowait": 0,
    "irq": 0,
    "softirq": 0,
    "steal": 0,
    "guest": 0,
    "guest_nice": 0,
    "dpc": null,
    "interrupt": null
  },
  {
    "key": "cpu_number",
    "cpu_number": 1,
    "total": 4.1,
    "user": 2.1,
    "system": 1.7,
    "idle": 95.9,
    "nice": 0,
    "iowait": 0.3,
    "irq": 0,
    "softirq": 0,
    "steal": 0,
    "guest": 0,
    "guest_nice": 0,
    "dpc": null,
    "interrupt": null
  },
  {
    "key": "cpu_number",
    "cpu_number": 2,
    "total": 3.5,
    "user": 2,
    "system": 1.5,
    "idle": 96.5,
    "nice": 0,
    "iowait": 0,
    "irq": 0,
    "softirq": 0,
    "steal": 0,
    "guest": 0,
    "guest_nice": 0,
    "dpc": null,
    "interrupt": null
  },
  {
    "key": "cpu_number",
    "cpu_number": 3,
    "total": 2.8,
    "user": 1.2,
    "system": 1.3,
    "idle": 97.2,
    "nice": 0,
    "iowait": 0.3,
    "irq": 0,
    "softirq": 0,
    "steal": 0,
    "guest": 0,
    "guest_nice": 0,
    "dpc": null,
    "interrupt": null
  }
];

export const rawLoad = {
  "min1": 0.22119140625,
  "min5": 0.6083984375,
  "min15": 0.68701171875,
  "cpucore": 12
};

export const rawMem = {
  "total": 132517171200,
  "available": 125637259264,
  "percent": 5.2,
  "used": 6879911936,
  "free": 1386852352,
  "active": 91296915456,
  "inactive": 35904208896,
  "buffers": 601890816,
  "cached": 125268156416,
  "shared": 347889664,
  "percent_min": 5,
  "percent_max": 18.4,
  "percent_mean": 7.25
};

export const rawMemswap = {
  "total": 8589930496,
  "used": 2199801856,
  "free": 6390128640,
  "percent": 25.6,
  "sin": 6796791808,
  "sout": 10105470976,
  "time_since_update": 2.0304272174835205
};

export const rawNetwork = [
  {
    "bytes_sent": 4562,
    "bytes_recv": 4562,
    "speed": 0,
    "key": "interface_name",
    "interface_name": "lo",
    "alias": null,
    "bytes_all": 9124,
    "time_since_update": 1.7106213569641113,
    "bytes_recv_gauge": 44412330671,
    "bytes_recv_rate_per_sec": 2666,
    "bytes_sent_gauge": 44412330671,
    "bytes_sent_rate_per_sec": 2666,
    "bytes_all_gauge": 88824661342,
    "bytes_all_rate_per_sec": 5333
  },
  {
    "bytes_sent": 6135866,
    "bytes_recv": 252114,
    "speed": 1048576000,
    "key": "interface_name",
    "interface_name": "enp5s0",
    "alias": null,
    "bytes_all": 6387980,
    "time_since_update": 1.7106213569641113,
    "bytes_recv_gauge": 2326082948932,
    "bytes_recv_rate_per_sec": 147381,
    "bytes_sent_gauge": 1078990390492,
    "bytes_sent_rate_per_sec": 3586922,
    "bytes_all_gauge": 3405073339424,
    "bytes_all_rate_per_sec": 3734303
  },
  {
    "bytes_sent": 126,
    "bytes_recv": 0,
    "speed": 10485760000,
    "key": "interface_name",
    "interface_name": "docker0",
    "alias": null,
    "bytes_all": 126,
    "time_since_update": 1.7106213569641113,
    "bytes_recv_gauge": 1329218419,
    "bytes_recv_rate_per_sec": 0,
    "bytes_sent_gauge": 249507557711,
    "bytes_sent_rate_per_sec": 73,
    "bytes_all_gauge": 250836776130,
    "bytes_all_rate_per_sec": 73
  }
];

export const rawDiskio = [
  {
    "read_count": 0,
    "write_count": 0,
    "read_bytes": 0,
    "write_bytes": 0,
    "read_time": 0,
    "write_time": 0,
    "key": "disk_name",
    "disk_name": "sda",
    "time_since_update": 2.0271856784820557,
    "read_count_gauge": 8679056,
    "read_count_rate_per_sec": 0,
    "write_count_gauge": 2480793,
    "write_count_rate_per_sec": 0,
    "read_bytes_gauge": 1941084539392,
    "read_bytes_rate_per_sec": 0,
    "write_bytes_gauge": 1946766589952,
    "write_bytes_rate_per_sec": 0,
    "read_time_gauge": 236534929,
    "read_time_rate_per_sec": 0,
    "write_time_gauge": 36026306,
    "write_time_rate_per_sec": 0,
    "read_latency": 0,
    "write_latency": 0
  },
  {
    "read_count": 0,
    "write_count": 0,
    "read_bytes": 0,
    "write_bytes": 0,
    "read_time": 0,
    "write_time": 0,
    "key": "disk_name",
    "disk_name": "sda1",
    "time_since_update": 2.0271856784820557,
    "read_count_gauge": 8678871,
    "read_count_rate_per_sec": 0,
    "write_count_gauge": 2480789,
    "write_count_rate_per_sec": 0,
    "read_bytes_gauge": 1941054872064,
    "read_bytes_rate_per_sec": 0,
    "write_bytes_gauge": 1946766589952,
    "write_bytes_rate_per_sec": 0,
    "read_time_gauge": 236534125,
    "read_time_rate_per_sec": 0,
    "write_time_gauge": 36026297,
    "write_time_rate_per_sec": 0,
    "read_latency": 0,
    "write_latency": 0
  },
  {
    "read_count": 0,
    "write_count": 4,
    "read_bytes": 0,
    "write_bytes": 57344,
    "read_time": 0,
    "write_time": 11,
    "key": "disk_name",
    "disk_name": "sdb",
    "time_since_update": 2.0271856784820557,
    "read_count_gauge": 3946720,
    "read_count_rate_per_sec": 0,
    "write_count_gauge": 10452264,
    "write_count_rate_per_sec": 1,
    "read_bytes_gauge": 149792694272,
    "read_bytes_rate_per_sec": 0,
    "write_bytes_gauge": 779269424128,
    "write_bytes_rate_per_sec": 28287,
    "read_time_gauge": 1285347,
    "read_time_rate_per_sec": 0,
    "write_time_gauge": 35249872,
    "write_time_rate_per_sec": 5,
    "read_latency": 0,
    "write_latency": 5
  }
];

export const rawFs = [
  {
    "device_name": "/dev/sdb2",
    "fs_type": "ext4",
    "mnt_point": "/usr/bin/nvidia-cuda-mps-control",
    "options": "ro,nosuid,nodev,relatime",
    "size": 243885932544,
    "used": 126464823296,
    "free": 104957841408,
    "percent": 54.6,
    "key": "mnt_point"
  },
  {
    "device_name": "/dev/sdb2",
    "fs_type": "ext4",
    "mnt_point": "/usr/bin/nvidia-cuda-mps-server",
    "options": "ro,nosuid,nodev,relatime",
    "size": 243885932544,
    "used": 126464823296,
    "free": 104957841408,
    "percent": 54.6,
    "key": "mnt_point"
  },
  {
    "device_name": "/dev/sdb2",
    "fs_type": "ext4",
    "mnt_point": "/usr/bin/nvidia-debugdump",
    "options": "ro,nosuid,nodev,relatime",
    "size": 243885932544,
    "used": 126464823296,
    "free": 104957841408,
    "percent": 54.6,
    "key": "mnt_point"
  }
];

export const rawSensors = [
  {
    "label": "Core 0",
    "unit": "C",
    "value": 33,
    "warning": 100,
    "critical": 100,
    "type": "temperature_core",
    "key": "label"
  },
  {
    "label": "Core 1",
    "unit": "C",
    "value": 34,
    "warning": 100,
    "critical": 100,
    "type": "temperature_core",
    "key": "label"
  },
  {
    "label": "Core 2",
    "unit": "C",
    "value": 30,
    "warning": 100,
    "critical": 100,
    "type": "temperature_core",
    "key": "label"
  },
  {
    "label": "Core 3",
    "unit": "C",
    "value": 30,
    "warning": 100,
    "critical": 100,
    "type": "temperature_core",
    "key": "label"
  }
];

export const rawGpu = [
  {
    "key": "gpu_id",
    "gpu_id": "nvidia0",
    "name": "NVIDIA GeForce RTX 3090",
    "mem": 1.9861857096354167,
    "proc": 0,
    "temperature": 24,
    "fan_speed": 33
  }
];

export const rawProcesslist = [
  {
    "name": "python3.14",
    "memory_info": {
      "rss": 232595456,
      "vms": 4161622016,
      "shared": 26353664,
      "text": 3694592,
      "lib": 0,
      "data": 626294784,
      "dirty": 0
    },
    "pid": 133118,
    "memory_percent": 0.17552099391629633,
    "cpu_times": {
      "user": 2528.44,
      "system": 574.26,
      "children_user": 17.44,
      "children_system": 111.33,
      "iowait": 0
    },
    "gids": {
      "real": 0,
      "effective": 0,
      "saved": 0
    },
    "io_counters": [
      962560,
      1503232,
      962560,
      1503232,
      1
    ],
    "nice": 0,
    "num_threads": 40,
    "status": "S",
    "cpu_percent": 6.2,
    "key": "pid",
    "time_since_update": 2.101757049560547,
    "cmdline": [
      "/venv/bin/python3.14",
      "-m",
      "glances",
      "-w"
    ],
    "username": "root"
  },
  {
    "name": "napi/tun0-0",
    "memory_info": {
      "rss": 0,
      "vms": 0,
      "shared": 0,
      "text": 0,
      "lib": 0,
      "data": 0,
      "dirty": 0
    },
    "pid": 4136959,
    "memory_percent": 0,
    "cpu_times": {
      "user": 0,
      "system": 869.12,
      "children_user": 0,
      "children_system": 0,
      "iowait": 0
    },
    "gids": {
      "real": 0,
      "effective": 0,
      "saved": 0
    },
    "io_counters": [
      0,
      0,
      0,
      0,
      0
    ],
    "nice": 0,
    "num_threads": 1,
    "status": "S",
    "cpu_percent": 2.9,
    "key": "pid",
    "time_since_update": 2.101757049560547,
    "cmdline": [],
    "username": "root"
  },
  {
    "name": "qbittorrent-nox",
    "memory_info": {
      "rss": 32269053952,
      "vms": 83116752896,
      "shared": 32250802176,
      "text": 17543168,
      "lib": 0,
      "data": 39206912,
      "dirty": 0
    },
    "pid": 1460105,
    "memory_percent": 24.350847259860615,
    "cpu_times": {
      "user": 3968.14,
      "system": 2735.26,
      "children_user": 0,
      "children_system": 0,
      "iowait": 0
    },
    "gids": {
      "real": 1000,
      "effective": 1000,
      "saved": 1000
    },
    "io_counters": [
      0,
      0,
      0,
      0,
      0
    ],
    "nice": 0,
    "num_threads": 19,
    "status": "S",
    "cpu_percent": 2.4,
    "key": "pid",
    "time_since_update": 2.101757049560547,
    "cmdline": [
      "/app/qbittorrent-nox",
      "--webui-port=8080",
      "--torrenting-port=57266"
    ],
    "username": "ubuntu"
  }
];

export const rawProcesscount = {
  "total": 529,
  "running": 0,
  "sleeping": 383,
  "thread": 2064,
  "pid_max": 0
};

export const rawContainers = [
  {
    "key": "name",
    "name": "glances-web",
    "id": "cc167a09e4c0b138e567bb1109a7509b70d6928e05c0b47e5a51dc2d01e942d5",
    "status": "running",
    "created": "2026-08-02T01:01:33.932607523Z",
    "command": "/bin/sh -c /venv/bin/python${PYTHON_VERSION} -m glances ${GLANCES_OPT}",
    "io": {
      "cumulative_ior": 12877824,
      "cumulative_iow": 5558272,
      "time_since_update": 3,
      "ior": 0,
      "iow": 0
    },
    "cpu": {
      "total": 12.916815920398008,
      "limit": 12
    },
    "memory": {
      "usage": 218877952,
      "limit": 132517171200,
      "inactive_file": 65536
    },
    "network": {},
    "io_rx": 0,
    "io_wx": 0,
    "cpu_percent": 12.916815920398008,
    "memory_percent": null,
    "network_rx": null,
    "network_tx": null,
    "ports": "",
    "uptime": "2 days",
    "image": [
      "nicolargo/glances:ubuntu-latest-full"
    ],
    "cpu_limit": 12,
    "memory_usage": 218877952,
    "memory_inactive_file": 65536,
    "memory_limit": 132517171200,
    "engine": "docker"
  },
  {
    "key": "name",
    "name": "qbittorrent",
    "id": "7d4933a0c769f902e0aefb87264004dcfa0790860c502a985808f3d2f3dafd55",
    "status": "running",
    "created": "2026-07-31T17:55:16.918113117Z",
    "command": "/init",
    "io": {
      "cumulative_ior": 179059585024,
      "cumulative_iow": 345196232704,
      "time_since_update": 3,
      "ior": 0,
      "iow": 0
    },
    "cpu": {
      "total": 2.8509693454846725,
      "limit": 12
    },
    "memory": {
      "usage": 108555038720,
      "limit": 132517171200,
      "inactive_file": 24185442304
    },
    "network": {
      "cumulative_rx": 387107392969,
      "cumulative_tx": 153060054589,
      "time_since_update": 3,
      "rx": 403906,
      "tx": 10749210
    },
    "io_rx": 0,
    "io_wx": 0,
    "cpu_percent": 2.8509693454846725,
    "memory_percent": null,
    "network_rx": 134635,
    "network_tx": 3583070,
    "ports": "",
    "uptime": "3 days",
    "image": [
      "lscr.io/linuxserver/qbittorrent:latest"
    ],
    "cpu_limit": 12,
    "memory_usage": 108555038720,
    "memory_inactive_file": 24185442304,
    "memory_limit": 132517171200,
    "engine": "docker"
  },
  {
    "key": "name",
    "name": "homeassistant",
    "id": "853541cd4300ffb983c15fbda5bad8b57ee36663ee35ac7e581d5e820685aa8f",
    "status": "running",
    "created": "2026-07-30T01:02:31.344479468Z",
    "command": "/init",
    "io": {
      "cumulative_ior": 450236416,
      "cumulative_iow": 5961526784,
      "time_since_update": 3,
      "ior": 0,
      "iow": 20480
    },
    "cpu": {
      "total": 1.3209942004971003,
      "limit": 12
    },
    "memory": {
      "usage": 642961408,
      "limit": 132517171200,
      "inactive_file": 35196928
    },
    "network": {},
    "io_rx": 0,
    "io_wx": 6826,
    "cpu_percent": 1.3209942004971003,
    "memory_percent": null,
    "network_rx": null,
    "network_tx": null,
    "ports": "",
    "uptime": "5 days",
    "image": [
      "lscr.io/linuxserver/homeassistant:latest"
    ],
    "cpu_limit": 12,
    "memory_usage": 642961408,
    "memory_inactive_file": 35196928,
    "memory_limit": 132517171200,
    "engine": "docker"
  }
];

export const rawSystem = {
  "os_name": "Linux",
  "hostname": "TCloud",
  "platform": "64bit",
  "os_version": "6.17.0-40-generic",
  "linux_distro": "Ubuntu 25.10",
  "hr_name": "Ubuntu 25.10 64bit / Linux 6.17.0-40-generic"
};

export const rawUptime = "31 days, 23:10:53";

export const rawQuicklook = {
  "cpu_name": "11th Gen Intel(R) Core(TM) i5-11500 @ 2.70GHz",
  "cpu_hz_current": 3766569916.666666,
  "cpu_hz": 4600000000,
  "cpu": 4.2,
  "percpu": [
    {
      "key": "cpu_number",
      "cpu_number": 0,
      "total": 3.6,
      "user": 1.8,
      "system": 1.6,
      "idle": 96.4,
      "nice": 0,
      "iowait": 0.2,
      "irq": 0,
      "softirq": 0,
      "steal": 0,
      "guest": 0,
      "guest_nice": 0,
      "dpc": null,
      "interrupt": null
    },
    {
      "key": "cpu_number",
      "cpu_number": 1,
      "total": 3.3,
      "user": 1.4,
      "system": 1.4,
      "idle": 96.7,
      "nice": 0,
      "iowait": 0.5,
      "irq": 0,
      "softirq": 0,
      "steal": 0,
      "guest": 0,
      "guest_nice": 0,
      "dpc": null,
      "interrupt": null
    },
    {
      "key": "cpu_number",
      "cpu_number": 2,
      "total": 3.6,
      "user": 1.9,
      "system": 1.6,
      "idle": 96.4,
      "nice": 0,
      "iowait": 0.2,
      "irq": 0,
      "softirq": 0,
      "steal": 0,
      "guest": 0,
      "guest_nice": 0,
      "dpc": null,
      "interrupt": null
    },
    {
      "key": "cpu_number",
      "cpu_number": 3,
      "total": 2.7,
      "user": 1.4,
      "system": 1.1,
      "idle": 97.3,
      "nice": 0,
      "iowait": 0.1,
      "irq": 0,
      "softirq": 0,
      "steal": 0,
      "guest": 0,
      "guest_nice": 0,
      "dpc": null,
      "interrupt": null
    }
  ],
  "mem": 5.2,
  "swap": 25.6,
  "cpu_log_core": 12,
  "cpu_phys_core": 6,
  "load": 5.8,
  "gpu_mem": 0,
  "gpu_proc": 0
};

export const rawAlert = [];

export const rawLimits = {
  "sensors": {
    "history_size": 1200,
    "sensors_disable": [
      "False"
    ],
    "sensors_refresh": 10,
    "sensors_hide": [
      "unknown.*"
    ],
    "sensors_temperature_core_careful": 45,
    "sensors_temperature_core_warning": 65,
    "sensors_temperature_core_critical": 80,
    "sensors_temperature_hdd_careful": 45,
    "sensors_temperature_hdd_warning": 52,
    "sensors_temperature_hdd_critical": 60,
    "sensors_battery_careful": 70,
    "sensors_battery_warning": 80,
    "sensors_battery_critical": 90
  },
  "mem": {
    "history_size": 1200,
    "mem_disable": [
      "False"
    ],
    "mem_careful": 50,
    "mem_warning": 70,
    "mem_critical": 90
  },
  "memswap": {
    "history_size": 1200,
    "memswap_disable": [
      "False"
    ],
    "memswap_careful": 50,
    "memswap_warning": 70,
    "memswap_critical": 90
  },
  "uptime": {
    "history_size": 1200
  },
  "processcount": {
    "history_size": 1200,
    "processcount_disable": [
      "False"
    ]
  },
  "folders": {
    "history_size": 1200,
    "folders_disable": [
      "False"
    ],
    "folders_refresh": 60
  },
  "now": {
    "history_size": 1200
  },
  "gpu": {
    "history_size": 1200,
    "gpu_disable": [
      "False"
    ],
    "gpu_proc_careful": 50,
    "gpu_proc_warning": 70,
    "gpu_proc_critical": 90,
    "gpu_mem_careful": 50,
    "gpu_mem_warning": 70,
    "gpu_mem_critical": 90,
    "gpu_temperature_careful": 60,
    "gpu_temperature_warning": 70,
    "gpu_temperature_critical": 80
  },
  "diskio": {
    "history_size": 1200,
    "diskio_disable": [
      "False"
    ],
    "diskio_hide": [
      "loop.*",
      "/dev/loop.*"
    ],
    "diskio_hide_zero": [
      "False"
    ],
    "diskio_rx_latency_careful": 10,
    "diskio_rx_latency_warning": 20,
    "diskio_rx_latency_critical": 50,
    "diskio_tx_latency_careful": 10,
    "diskio_tx_latency_warning": 20,
    "diskio_tx_latency_critical": 50
  },
  "percpu": {
    "history_size": 1200,
    "percpu_disable": [
      "False"
    ],
    "percpu_max_cpu_display": 4,
    "percpu_user_careful": 50,
    "percpu_user_warning": 70,
    "percpu_user_critical": 90,
    "percpu_iowait_careful": 50,
    "percpu_iowait_warning": 70,
    "percpu_iowait_critical": 90,
    "percpu_system_careful": 50,
    "percpu_system_warning": 70,
    "percpu_system_critical": 90
  },
  "quicklook": {
    "history_size": 1200,
    "quicklook_disable": [
      "False"
    ],
    "quicklook_list": [
      "cpu",
      "mem",
      "load"
    ],
    "quicklook_bar_char": [
      "▪"
    ],
    "quicklook_cpu_careful": 50,
    "quicklook_cpu_warning": 70,
    "quicklook_cpu_critical": 90,
    "quicklook_mem_careful": 50,
    "quicklook_mem_warning": 70,
    "quicklook_mem_critical": 90,
    "quicklook_swap_careful": 50,
    "quicklook_swap_warning": 70,
    "quicklook_swap_critical": 90,
    "quicklook_load_careful": 70,
    "quicklook_load_warning": 100,
    "quicklook_load_critical": 500,
    "quicklook_gpu_proc_careful": 50,
    "quicklook_gpu_proc_warning": 70,
    "quicklook_gpu_proc_critical": 90,
    "quicklook_gpu_mem_careful": 50,
    "quicklook_gpu_mem_warning": 70,
    "quicklook_gpu_mem_critical": 90
  },
  "cpu": {
    "history_size": 1200,
    "cpu_disable": [
      "False"
    ],
    "cpu_total_careful": 65,
    "cpu_total_warning": 75,
    "cpu_total_critical": 85,
    "cpu_total_log": [
      "True"
    ],
    "cpu_user_careful": 50,
    "cpu_user_warning": 70,
    "cpu_user_critical": 90,
    "cpu_user_log": [
      "False"
    ],
    "cpu_system_careful": 50,
    "cpu_system_warning": 70,
    "cpu_system_critical": 90,
    "cpu_system_log": [
      "False"
    ],
    "cpu_steal_careful": 50,
    "cpu_steal_warning": 70,
    "cpu_steal_critical": 90,
    "cpu_iowait_careful": 50,
    "cpu_iowait_warning": 70,
    "cpu_iowait_critical": 90,
    "cpu_ctx_switches_careful": 480000,
    "cpu_ctx_switches_warning": 540000,
    "cpu_ctx_switches_critical": 600000
  },
  "ip": {
    "history_size": 1200,
    "ip_disable": [
      "False"
    ],
    "ip_refresh": 60,
    "ip_public_disabled": [
      "True"
    ],
    "ip_public_refresh_interval": 300,
    "ip_public_api": [
      "https://ipv4.ipleak.net/json/"
    ],
    "ip_public_field": [
      "ip"
    ],
    "ip_public_template": [
      "{continent_name}/{country_name}/{city_name}"
    ]
  },
  "psutilversion": {
    "history_size": 1200
  },
  "processlist": {
    "history_size": 1200,
    "processlist_disable": [
      "False"
    ],
    "processlist_disable_stats": [
      "cpu_num"
    ],
    "processlist_cpu_careful": 50,
    "processlist_cpu_warning": 70,
    "processlist_cpu_critical": 90,
    "processlist_mem_careful": 50,
    "processlist_mem_warning": 70,
    "processlist_mem_critical": 90,
    "processlist_nice_warning": [
      "-20",
      "-19",
      "-18",
      "-17",
      "-16",
      "-15",
      "-14",
      "-13",
      "-12",
      "-11",
      "-10",
      "-9",
      "-8",
      "-7",
      "-6",
      "-5",
      "-4",
      "-3",
      "-2",
      "-1",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "18",
      "19"
    ],
    "processlist_status_ok": [
      "R",
      "W",
      "P",
      "I"
    ],
    "processlist_status_critical": [
      "Z",
      "D"
    ]
  },
  "core": {
    "history_size": 1200
  },
  "ports": {
    "history_size": 1200,
    "ports_disable": [
      "False"
    ],
    "ports_refresh": 30,
    "ports_timeout": 3,
    "ports_port_default_gateway": [
      "False"
    ]
  },
  "help": {
    "history_size": 1200
  },
  "amps": {
    "history_size": 1200,
    "amps_disable": [
      "False"
    ]
  },
  "version": {
    "history_size": 1200
  },
  "system": {
    "history_size": 1200,
    "system_disable": [
      "False"
    ],
    "system_refresh": 60
  },
  "wifi": {
    "history_size": 1200,
    "wifi_disable": [
      "False"
    ],
    "wifi_careful": -65,
    "wifi_warning": -75,
    "wifi_critical": -85
  },
  "fs": {
    "history_size": 1200,
    "fs_disable": [
      "False"
    ],
    "fs_refresh": 60,
    "fs_hide": [
      "/boot.*",
      ".*/snap.*"
    ],
    "fs_careful": 50,
    "fs_warning": 70,
    "fs_critical": 90
  },
  "containers": {
    "history_size": 1200,
    "containers_disable": [
      "False"
    ],
    "containers_max_name_size": 20,
    "containers_disable_stats": [
      "command"
    ],
    "containers_all": [
      "False"
    ]
  },
  "alert": {
    "history_size": 1200,
    "alert_disable": [
      "False"
    ]
  },
  "network": {
    "history_size": 1200,
    "network_disable": [
      "False"
    ],
    "network_rx_careful": 70,
    "network_rx_warning": 80,
    "network_rx_critical": 90,
    "network_tx_careful": 70,
    "network_tx_warning": 80,
    "network_tx_critical": 90,
    "network_hide_no_up": [
      "True"
    ],
    "network_hide_no_ip": [
      "True"
    ],
    "network_hide_zero": [
      "False"
    ]
  },
  "programlist": {
    "history_size": 1200
  },
  "load": {
    "history_size": 1200,
    "load_disable": [
      "False"
    ],
    "load_careful": 0.7,
    "load_warning": 1,
    "load_critical": 5
  }
};
