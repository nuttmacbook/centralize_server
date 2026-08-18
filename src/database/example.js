import { DB } from "./database/lmdb.js";

const db = new DB("testDBServer");

// เขียนข้อมูล
db.write("record:1", { foo: "bar" });
db.write("record:2", { name: "Alice" });
db.write("record:3", { name: "Bob" });
db.commit();

console.log("✅ เขียนข้อมูล 3 records ลงฐานเรียบร้อย");

// อ่านข้อมูลเดี่ยว
console.log("📖 read record:1:", db.read("record:1"));

// อ่านหลาย record (async)
db.readMany(["record:1", "record:2"]).then(results => {
  console.log("📖 readMany:", results);
});

// แบบเดิม: ใช้ start + end (exclusive)
console.log("📖 readRange:", db.readRange("record:1", "record:3"));

// แบบใหม่: ใช้ start + limit
console.log("📖 readRangeLimit:", db.readRangeLimit("record:1", 3));

// ตรวจสอบ key
console.log("🔍 exists record:2?", db.exists("record:2"));
console.log("🔍 exists record:999?", db.exists("record:999"));

// ลบข้อมูล
db.remove("record:3");
console.log("❌ remove record:3 → exists?", db.exists("record:3"));

// นับจำนวนทั้งหมด
console.log("📊 count:", db.count());

// iterate ผ่านทุก record
db.iterate((key, value) => {
  console.log("🔄 iterate:", key, value);
});

// update ข้อมูล
db.update("record:2", old => ({ ...old, age: 25 }));
console.log("✏️ updated record:2:", db.read("record:2"));

// Backup → return JSON object
const backupData = db.backupToJSON();
console.log("📦 Backup JSON:", backupData);

// Restore → ใช้ JSON object ที่ได้
db.restoreFromJSON(backupData);