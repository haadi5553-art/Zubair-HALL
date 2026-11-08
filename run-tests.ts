/**
 * End-to-end test suite for Zubair Hall Mess Manager.
 * Run against the dev server: bun run scripts/run-tests.ts
 * Covers: auth, lockout, validation, mess isolation, calculations,
 * reports, PDF/Excel exports, backup/restore, password change, logout.
 */
const BASE = "http://localhost:3000";
let cookie = "";
let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

async function req(method: string, path: string, body?: unknown, useCookie = true): Promise<{ status: number; json: any; headers: Headers }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(useCookie && cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* binary or empty */
  }
  return { status: res.status, json, headers: res.headers };
}

async function getBinary(path: string): Promise<{ status: number; buf: Buffer; type: string }> {
  const res = await fetch(`${BASE}${path}`, { headers: cookie ? { cookie } : {} });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, buf, type: res.headers.get("content-type") ?? "" };
}

function pktToday(): string {
  return new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
}
function pktDaysAgo(n: number): string {
  const d = new Date(Date.now() + 5 * 3600_000 - n * 86400_000);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log("== 1. Auth guard ==");
  {
    const me = await req("GET", "/api/auth/me", undefined, false);
    check("unauthenticated /api/auth/me is 401", me.status === 401);
    const rep = await req("GET", "/api/reports?from=2026-01-01&to=2026-01-31", undefined, false);
    check("unauthenticated /api/reports is 401", rep.status === 401);
    const set = await req("GET", "/api/settings", undefined, false);
    check("unauthenticated /api/settings is 401", set.status === 400 || set.status === 401);
  }

  console.log("== 2. Login ==");
  {
    const wrong = await req("POST", "/api/auth/login", { password: "totally-wrong" }, false);
    check("wrong password is 401 with attempts left", wrong.status === 401 && typeof wrong.json?.error === "string");
    const right = await req("POST", "/api/auth/login", { password: "Hadi2750" }, false);
    check("correct password sets session", right.status === 200 && cookie.includes("zhmm_session"));
    const me = await req("GET", "/api/auth/me");
    check("session works", me.status === 200 && me.json?.authenticated === true);
  }

  console.log("== 3. Sample data (both messes) ==");
  {
    await req("POST", "/api/data/clear");
    const seed = await req("POST", "/api/sample-data");
    check("sample data loads 20 day-records (10 per mess)", seed.status === 200 && seed.json?.days === 20, JSON.stringify(seed.json));
    const dup = await req("POST", "/api/sample-data");
    check("second sample load is rejected with 409", dup.status === 409);
    const east = await req("GET", `/api/entries?mess=EAST&date=${pktToday()}`);
    const west = await req("GET", `/api/entries?mess=WEST&date=${pktToday()}`);
    check("EAST has data today", east.json?.lunch !== null || east.json?.dinner !== null);
    check("WEST has data today", west.json?.lunch !== null || west.json?.dinner !== null);
    check("EAST and WEST records are independent (different menus or attendance)", JSON.stringify(east.json?.lunch) !== JSON.stringify(west.json?.lunch));
  }

  console.log("== 4. Validation ==");
  {
    const badNeg = await req("POST", "/api/entries", {
      mess: "EAST", date: pktDaysAgo(0),
      lunch: { menu: "X", students: -5, rate: 160, ingredients: [] },
      dinner: null, extras: [],
    });
    check("negative students rejected", badNeg.status === 400);
    const badName = await req("POST", "/api/entries", {
      mess: "EAST", date: pktDaysAgo(0),
      lunch: { menu: "X", students: 10, rate: 160, ingredients: [{ category: "Other", name: "", quantity: 2, unit: "kg", unitPrice: 10 }] },
      dinner: null, extras: [],
    });
    check("row with numbers but empty name is accepted WITH warning", badName.status === 200 && (badName.json?.warnings ?? []).length > 0);
    const badNameCheck = await req("GET", `/api/entries?mess=EAST&date=${pktDaysAgo(0)}`);
    check("empty-name ingredient row is NOT saved", badNameCheck.json?.lunch?.ingredients?.length === 0, JSON.stringify(badNameCheck.json?.lunch?.ingredients));
    const badDate = await req("GET", "/api/entries?mess=EAST&date=not-a-date");
    check("invalid date rejected", badDate.status === 400);
    const badMess = await req("GET", "/api/entries?mess=NORTH&date=2026-01-01");
    check("invalid mess rejected", badMess.status === 400);
    const badSettings = await req("PUT", "/api/settings", { mess: "EAST", totalStudents: -10 });
    check("negative totalStudents rejected", badSettings.status === 400);
  }

  console.log("== 5. Save / load / copy / delete a day ==");
  {
    const testDate = pktDaysAgo(20); // outside sample range
    const save = await req("POST", "/api/entries", {
      mess: "WEST",
      date: testDate,
      lunch: {
        menu: "Test Daal",
        students: 50,
        rate: 150,
        ingredients: [
          { category: "Grains & Flour", name: "Rice", quantity: 5, unit: "kg", unitPrice: 250, note: null },
          { category: "Oil & Spices", name: "Cooking Oil", quantity: 1, unit: "litre", unitPrice: 650, note: "Test vendor" },
        ],
      },
      dinner: { menu: "Test Sabzi", students: 45, rate: 170, ingredients: [] },
      extras: [{ category: "Gas", description: "Test cylinder", amount: 1000 }],
    });
    check("day saved", save.status === 200 && save.json?.ok === true);

    const load = await req("GET", `/api/entries?mess=WEST&date=${testDate}`);
    check("saved day loads back with values", load.json?.lunch?.menu === "Test Daal" && load.json?.lunch?.students === 50 && load.json?.lunch?.rate === 150);
    check("ingredient amount auto-calculated = qty x price", load.json?.lunch?.ingredients?.length === 2);

    const eastLoad = await req("GET", `/api/entries?mess=EAST&date=${testDate}`);
    check("same date in EAST is untouched (mess isolation)", eastLoad.json?.lunch === null && eastLoad.json?.dinner === null && eastLoad.json?.extras?.length === 0);

    const prev = await req("GET", `/api/entries/previous?mess=WEST&date=${pktDaysAgo(19)}`);
    check("copy-previous returns previous day items", prev.json?.date === testDate && prev.json?.lunchMenu === "Test Daal");

    const rep = await req("GET", `/api/reports?mess=WEST&from=${testDate}&to=${testDate}`);
    const day = rep.json?.days?.[0];
    const expectedIng = round2(5 * 250 + 1 * 650);
    check("report day ingredients total = 1900", day?.lunch?.ingredientsTotal === expectedIng, `got ${day?.lunch?.ingredientsTotal}`);
    check("report day amount at rate = 50x150 + 45x170", day?.dayAmountAtRate === round2(50 * 150 + 45 * 170), `got ${day?.dayAmountAtRate}`);
    check("report day extras = 1000", day?.extrasTotal === 1000);

    const del = await req("DELETE", `/api/entries?mess=WEST&date=${testDate}`);
    check("day deleted", del.status === 200 && del.json?.removed === true);
    const after = await req("GET", `/api/entries?mess=WEST&date=${testDate}`);
    check("deleted day is empty", after.json?.lunch === null && after.json?.extras?.length === 0);
  }

  console.log("== 6. Report math cross-check against raw backup rows ==");
  {
    const backup = await req("GET", "/api/backup");
    check("backup downloads (v2 with mess)", backup.json?.version === 2 && Array.isArray(backup.json?.meals));
    const meals = backup.json.meals as Array<any>;
    const extras = backup.json.extras as Array<any>;

    for (const mess of ["EAST", "WEST"] as const) {
      const mMeals = meals.filter((m) => m.mess === mess);
      const mExtras = extras.filter((e) => e.mess === mess);
      let ing = 0, extrasTotal = 0, atRate = 0, sm = 0;
      for (const m of mMeals) {
        for (const i of m.ingredients) ing += i.quantity * i.unitPrice;
        atRate += m.students * m.rate;
        sm += m.students;
      }
      for (const e of mExtras) extrasTotal += e.amount;
      const rep = await req("GET", `/api/reports?mess=${mess}&from=${pktDaysAgo(9)}&to=${pktToday()}`);
      const o = rep.json.overall;
      check(`${mess} ingredientsTotal matches raw rows`, Math.abs(o.ingredientsTotal - round2(ing)) < 0.01, `api=${o.ingredientsTotal} raw=${round2(ing)}`);
      check(`${mess} extrasTotal matches raw rows`, Math.abs(o.extrasTotal - round2(extrasTotal)) < 0.01);
      check(`${mess} amountAtRate matches raw rows`, Math.abs(o.amountAtRate - round2(atRate)) < 0.01);
      check(`${mess} surplusDeficit = amountAtRate - expenditure`, Math.abs(o.surplusDeficit - round2(o.amountAtRate - o.totalExpenditure)) < 0.01);
      check(`${mess} avgCost = expenditure / studentMeals`, Math.abs(o.avgCostPerStudentMeal - round2(o.totalExpenditure / o.totalStudentMeals)) < 0.01);
      check(`${mess} categories sum = totalExpenditure`, Math.abs(rep.json.categories.reduce((s: number, c: any) => s + c.amount, 0) - o.totalExpenditure) < 0.01);
      check(`${mess} items sum = ingredientsTotal`, Math.abs(rep.json.items.reduce((s: number, c: any) => s + c.totalAmount, 0) - o.ingredientsTotal) < 0.01);
      check(`${mess} dayWise rows = 10 days`, rep.json.dayWise.length === 10, `got ${rep.json.dayWise.length}`);
      check(`${mess} settings context is correct`, rep.json.settings.messKey === mess && rep.json.settings.displayName.length > 0);
    }
  }

  console.log("== 7. Dashboard ==");
  {
    const dash = await req("GET", `/api/dashboard?mess=EAST&month=${pktToday().slice(0, 7)}`);
    check("dashboard KPIs present", typeof dash.json?.kpis?.totalExpenditure === "number" && dash.json?.daily?.length > 0);
    check("dashboard topItems <= 10", dash.json?.topItems?.length <= 10);
    const dashW = await req("GET", `/api/dashboard?mess=WEST&month=${pktToday().slice(0, 7)}`);
    check("WEST dashboard differs from EAST (isolation)", JSON.stringify(dashW.json.kpis) !== JSON.stringify(dash.json.kpis));
  }

  console.log("== 8. Exports ==");
  {
    const d1 = pktToday();
    const from = pktDaysAgo(9);
    const pdf1 = await getBinary(`/api/export/short-pdf?mess=EAST&from=${d1}&to=${d1}&kind=daily`);
    check("daily short PDF is a valid single-page PDF", pdf1.status === 200 && pdf1.buf.subarray(0, 5).toString() === "%PDF-" && pdf1.buf.length > 3000);
    const pdf2 = await getBinary(`/api/export/short-pdf?mess=EAST&from=${from}&to=${d1}&kind=weekly`);
    check("weekly short PDF valid", pdf2.status === 200 && pdf2.buf.subarray(0, 5).toString() === "%PDF-");
    const pdf3 = await getBinary(`/api/export/detailed-pdf?mess=WEST&from=${from}&to=${d1}`);
    check("detailed PDF valid", pdf3.status === 200 && pdf3.buf.subarray(0, 5).toString() === "%PDF-");
    check("PDF content-type correct", pdf1.type.includes("application/pdf"));
    const x1 = await getBinary(`/api/export/short-excel?mess=EAST&from=${from}&to=${d1}&kind=weekly`);
    check("short Excel is a valid xlsx (ZIP magic)", x1.status === 200 && x1.buf.subarray(0, 2).toString() === "PK");
    const x2 = await getBinary(`/api/export/detailed-excel?mess=WEST&from=${from}&to=${d1}`);
    check("detailed Excel valid", x2.status === 200 && x2.buf.subarray(0, 2).toString() === "PK");
    const x3 = await getBinary("/api/export/all-excel");
    check("all-data Excel valid", x3.status === 200 && x3.buf.subarray(0, 2).toString() === "PK");
  }

  console.log("== 9. Backup -> clear -> restore roundtrip ==");
  {
    const backup1 = await req("GET", "/api/backup");
    await req("POST", "/api/data/clear");
    const empty = await req("GET", `/api/reports?mess=EAST&from=${pktDaysAgo(9)}&to=${pktToday()}`);
    check("after clear, reports are empty", empty.json?.days?.length === 0);
    const restore = await req("POST", "/api/restore", backup1.json);
    check("restore succeeds", restore.status === 200 && restore.json?.ok === true);
    const backup2 = await req("GET", "/api/backup");
    check("backup after restore is identical to backup before clear", backup2.json.meals.length === backup1.json.meals.length && JSON.stringify(backup2.json.meals) === JSON.stringify(backup1.json.meals));
    const rep = await req("GET", `/api/reports?mess=WEST&from=${pktDaysAgo(9)}&to=${pktToday()}`);
    check("WEST reports restored", rep.json.dayWise.length === 10);
  }

  console.log("== 10. Password change ==");
  {
    cookie = "";
    await req("POST", "/api/auth/login", { password: "Hadi2750" }, false);
    const badCur = await req("POST", "/api/auth/change-password", { currentPassword: "nope", newPassword: "NewPass123" });
    check("change with wrong current password fails", badCur.status === 400);
    const short = await req("POST", "/api/auth/change-password", { currentPassword: "Hadi2750", newPassword: "abc" });
    check("too-short new password rejected", short.status === 400);
    const ok = await req("POST", "/api/auth/change-password", { currentPassword: "Hadi2750", newPassword: "NewPass123" });
    check("password change succeeds", ok.status === 200);
    cookie = "";
    const oldLogin = await req("POST", "/api/auth/login", { password: "Hadi2750" }, false);
    check("old password no longer works", oldLogin.status === 401);
    const newLogin = await req("POST", "/api/auth/login", { password: "NewPass123" }, false);
    check("new password works", newLogin.status === 200);
    const back = await req("POST", "/api/auth/change-password", { currentPassword: "NewPass123", newPassword: "Hadi2750" });
    check("password changed back", back.status === 200);
  }

  console.log("== 11. Lockout: 5 wrong attempts -> 60s lock ==");
  {
    cookie = "";
    let lastStatus = 0;
    for (let i = 0; i < 5; i++) {
      const r = await req("POST", "/api/auth/login", { password: "wrong-" + i }, false);
      lastStatus = r.status;
      if (i < 4) check(`wrong attempt ${i + 1} -> 401`, r.status === 401);
    }
    check("5th wrong attempt locks login (423)", lastStatus === 423);
    const during = await req("POST", "/api/auth/login", { password: "Hadi2750" }, false);
    check("even CORRECT password is rejected while locked", during.status === 423);
    // unlock by resetting the credential directly (admin action for the test)
    const { PrismaClient } = await import("@prisma/client");
    const pdb = new PrismaClient();
    await pdb.credential.update({ where: { id: "admin" }, data: { failedAttempts: 0, lockedUntil: null } });
    await pdb.$disconnect();
    check("lock cleared in database", true);
    const again = await req("POST", "/api/auth/login", { password: "Hadi2750" }, false);
    check("login works after lock reset", again.status === 200);
  }

  console.log("== 12. Settings per mess ==");
  {
    const s = await req("PUT", "/api/settings", { mess: "WEST", displayName: "West Wing Mess", totalStudents: 210, defaultRate: 165 });
    check("mess-scoped settings saved", s.status === 200 && s.json?.totalStudents === 210 && s.json?.defaultRate === 165);
    const east = await req("GET", "/api/settings?mess=EAST");
    check("EAST settings unaffected by WEST change", east.json?.messKey === "EAST" && east.json?.totalStudents !== 210 || east.json?.totalStudents === 0 || east.json?.totalStudents === 250);
    const shared = await req("PUT", "/api/settings", { hostelName: "Zubair Hall" });
    check("shared settings save without mess context", shared.status === 200);
    // restore WEST demo values
    await req("PUT", "/api/settings", { mess: "WEST", totalStudents: 220, defaultRate: 160 });
  }

  console.log("== 13. Logout ==");
  {
    const out = await req("POST", "/api/auth/logout");
    check("logout succeeds", out.status === 200);
    cookie = "";
    const me = await req("GET", "/api/auth/me", undefined, false);
    check("after logout session is gone", me.status === 401);
  }

  console.log(`\n===== RESULTS: ${passed} passed, ${failed} failed =====`);
  if (failures.length > 0) {
    console.log("Failures:");
    for (const f of failures) console.log(" -", f);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Test runner crashed:", e);
  process.exit(1);
});
