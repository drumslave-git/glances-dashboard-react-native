/**
 * Real payloads captured from a live Glances 4 server (Ubuntu 25.10, 12 cores)
 * on 2026-08-03. Trimmed where the response was long, but shapes and value
 * types are untouched — prefer these over hand-written objects in tests.
 */

export const pluginsListFixture = [
  'sensors', 'mem', 'memswap', 'uptime', 'processcount', 'folders', 'now', 'gpu',
  'diskio', 'percpu', 'quicklook', 'cpu', 'ip', 'psutilversion', 'processlist',
  'core', 'ports', 'help', 'amps', 'version', 'system', 'wifi', 'fs', 'containers',
  'alert', 'network', 'programlist', 'load',
];

export const systemFixture = {
  os_name: 'Linux',
  hostname: 'TCloud',
  platform: '64bit',
  os_version: '6.17.0-40-generic',
  linux_distro: 'Ubuntu 25.10',
  hr_name: 'Ubuntu 25.10 64bit / Linux 6.17.0-40-generic',
};

export const cpuFixture = {
  total: 46.8,
  user: 46.0,
  nice: 0.0,
  system: 0.8,
  idle: 53.1,
  iowait: 0.0,
  irq: 0.0,
  steal: 0.0,
  guest: 0.0,
  ctx_switches: 227393,
  interrupts: 218509,
  soft_interrupts: 85640,
  syscalls: 0,
  cpucore: 12,
  time_since_update: 22.038609266281128,
};

export const memFixture = {
  total: 132517171200,
  available: 111225667584,
  percent: 16.1,
  used: 21291503616,
  free: 1500827648,
  active: 52053774336,
  inactive: 75386671104,
  buffers: 699396096,
  cached: 110985678848,
  shared: 688345088,
};

/**
 * `fs` is an array, and on a containerised Glances the first entries are bind
 * mounts rather than real disks — a widget showing "the first element" will look
 * odd, which is worth remembering when the fs widget gets attention.
 */
export const fsFixture = [
  {
    device_name: '/dev/sdb2',
    fs_type: 'ext4',
    mnt_point: '/usr/bin/nvidia-smi',
    options: 'ro,nosuid,nodev,relatime',
    size: 243885932544,
    used: 125517684736,
    free: 105904979968,
    percent: 54.2,
    key: 'mnt_point',
  },
  {
    device_name: '/dev/sda1',
    fs_type: 'xfs',
    mnt_point: '/host_mnt/disks/disk14TB',
    options: 'ro,relatime,attr2,inode64',
    size: 13998382592000,
    used: 9916989890560,
    free: 4081392701440,
    percent: 70.8,
    key: 'mnt_point',
  },
  {
    device_name: '/dev/sdf1',
    fs_type: 'xfs',
    mnt_point: '/host_mnt/disks/external/disk1TB',
    options: 'ro,relatime',
    size: 1000137744384,
    used: 73571864576,
    free: 926565879808,
    percent: 7.4,
    key: 'mnt_point',
  },
];

/** Note `cmdline` is an array and `memory_info` is nested — neither is a scalar. */
export const processListFixture = [
  {
    name: 'llama-server',
    cmdline: ['/usr/lib/ollama/llama-server', '--model', '/root/.ollama/models/blobs/sha256-1278', '--port', '33505'],
    memory_info: { rss: 16969019392, vms: 81200021504, shared: 2957983744 },
    pid: 3144580,
    memory_percent: 12.80514761848463,
    username: 'root',
    nice: 0,
    num_threads: 23,
    status: 'R',
    cpu_percent: 534.1,
    key: 'pid',
  },
  {
    name: 'systemd',
    cmdline: ['/sbin/init'],
    memory_info: { rss: 12345678, vms: 23456789, shared: 3456789 },
    pid: 1,
    memory_percent: 0.01,
    username: 'root',
    nice: 0,
    num_threads: 1,
    status: 'S',
    cpu_percent: 0.0,
    key: 'pid',
  },
];
