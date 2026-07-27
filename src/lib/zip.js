const textEncoder = new TextEncoder();

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { time, date: dosDate };
}

function u16(view, offset, value) { view.setUint16(offset, value, true); }
function u32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }

async function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  return textEncoder.encode(String(data ?? ""));
}

export async function createZipBlob(files) {
  const entries = [];
  let localSize = 0;
  const stamp = dosDateTime();

  for (const file of files) {
    const name = textEncoder.encode(file.name);
    const data = await toBytes(file.data);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const view = new DataView(local.buffer);
    u32(view, 0, 0x04034b50);
    u16(view, 4, 20);
    u16(view, 6, 0x0800);
    u16(view, 8, 0);
    u16(view, 10, stamp.time);
    u16(view, 12, stamp.date);
    u32(view, 14, crc);
    u32(view, 18, data.length);
    u32(view, 22, data.length);
    u16(view, 26, name.length);
    u16(view, 28, 0);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    entries.push({ name, data, crc, offset: localSize, local });
    localSize += local.length;
  }

  let centralSize = 0;
  const centralParts = entries.map((entry) => {
    const central = new Uint8Array(46 + entry.name.length);
    const view = new DataView(central.buffer);
    u32(view, 0, 0x02014b50);
    u16(view, 4, 20);
    u16(view, 6, 20);
    u16(view, 8, 0x0800);
    u16(view, 10, 0);
    u16(view, 12, stamp.time);
    u16(view, 14, stamp.date);
    u32(view, 16, entry.crc);
    u32(view, 20, entry.data.length);
    u32(view, 24, entry.data.length);
    u16(view, 28, entry.name.length);
    u16(view, 30, 0);
    u16(view, 32, 0);
    u16(view, 34, 0);
    u16(view, 36, 0);
    u32(view, 38, 0);
    u32(view, 42, entry.offset);
    central.set(entry.name, 46);
    centralSize += central.length;
    return central;
  });

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  u32(endView, 0, 0x06054b50);
  u16(endView, 4, 0);
  u16(endView, 6, 0);
  u16(endView, 8, entries.length);
  u16(endView, 10, entries.length);
  u32(endView, 12, centralSize);
  u32(endView, 16, localSize);
  u16(endView, 20, 0);

  return new Blob([...entries.map((entry) => entry.local), ...centralParts, end], { type: "application/zip" });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
