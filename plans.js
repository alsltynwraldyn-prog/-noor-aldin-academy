import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.ORVEXAL_SUPABASE;
const status = document.querySelector("#plan-status");
const buttons = [...document.querySelectorAll("[data-plan]")];
const priceTargets = {
  vip_monthly: document.querySelector("#monthly-price"),
  vip_yearly: document.querySelector("#yearly-price")
};
const formatJod = fils => (fils / 1000).toFixed(3) + " د.أ";

if (!cfg?.url?.startsWith("https://") || cfg.url.includes("YOUR-PROJECT") || !cfg.anonKey || cfg.anonKey.includes("YOUR_")) {
  status.textContent = "يلزم إكمال إعداد Supabase قبل تحميل الاشتراكات.";
} else {
  const sb = createClient(cfg.url, cfg.anonKey);
  try {
    const [{ data: { session } }, { data: plans, error }] = await Promise.all([
      sb.auth.getSession(),
      sb.from("plans").select("id,name_ar,billing_period,amount_minor,currency,active").in("id", ["vip_monthly", "vip_yearly"])
    ]);

    if (error) throw error;

    const planById = new Map((plans || []).map(plan => [plan.id, plan]));
    for (const [id, target] of Object.entries(priceTargets)) {
      const plan = planById.get(id);
      if (target && plan && Number.isInteger(plan.amount_minor) && plan.amount_minor > 0) {
        target.textContent = formatJod(plan.amount_minor) + (id === "vip_monthly" ? " / شهر" : " / سنة");
      }
    }

    if (session?.user) {
      const { data: subs, error: subError } = await sb.from("subscriptions")
        .select("plan_id,status,ends_at")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .order("ends_at", { ascending: false })
        .limit(1);
      if (!subError && subs?.length) {
        status.textContent = "عضويتك الحالية: " + subs[0].plan_id + " — تنتهي: " + new Date(subs[0].ends_at).toLocaleDateString("ar-JO");
      }
    }

    let activeCount = 0;
    for (const button of buttons) {
      const plan = planById.get(button.dataset.plan);
      if (!plan || !plan.active || !Number.isInteger(plan.amount_minor) || plan.amount_minor <= 0 || plan.currency !== "JOD") {
        button.disabled = true;
        continue;
      }
      activeCount++;
      button.disabled = false;
      button.textContent = (session?.user ? "اشترك الآن — " : "سجّل الدخول للاشتراك — ") + formatJod(plan.amount_minor);
      button.addEventListener("click", async () => {
        if (!session?.user) {
          location.href = "account.html";
          return;
        }
        button.disabled = true;
        button.textContent = "جارٍ تجهيز الدفع...";
        const { data, error: checkoutError } = await sb.functions.invoke("create-checkout", { body: { planId: plan.id } });
        if (checkoutError || !data?.checkoutUrl) {
          status.textContent = checkoutError?.message || data?.error || "تعذر بدء الدفع. تحقق من إعدادات بوابة الدفع.";
          button.disabled = false;
          button.textContent = "إعادة المحاولة";
          return;
        }
        location.href = data.checkoutUrl;
      });
    }

    if (!activeCount) {
      status.textContent = "الأسعار ظاهرة، وتفعيل أزرار الاشتراك ينتظر تفعيل الباقات في قاعدة البيانات وربط بوابة الدفع.";
    } else if (!session?.user) {
      status.textContent = "الباقات متاحة. سجّل الدخول لإكمال الاشتراك.";
    } else if (!status.textContent.startsWith("عضويتك الحالية:")) {
      status.textContent = "تم تحميل الباقات. اختر العضوية المناسبة لإكمال الدفع.";
    }
  } catch (error) {
    status.textContent = "تعذر تحميل بيانات الاشتراك: " + (error.message || "خطأ غير معروف");
  }
}