import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cfg=window.ARVYQEN_SUPABASE;
const status=document.querySelector("#plan-status");
if(cfg?.url?.startsWith("https://") && !cfg.url.includes("YOUR-PROJECT") && cfg.anonKey && !cfg.anonKey.includes("YOUR_")){
  const sb=createClient(cfg.url,cfg.anonKey);
  const [{data:{session}},{data:plans,error}]=await Promise.all([sb.auth.getSession(),sb.from("plans").select("id,name_ar,billing_period,amount_minor,currency,active").eq("active",true)]);
  if(error) status.textContent="تعذر تحميل الباقات. تحقق من إعداد قاعدة البيانات.";
  else if(plans?.length) status.textContent="تم تحميل "+plans.length+" باقة. تفعيل الدفع يحتاج إعداد بوابة الدفع والأسعار.";
  if(session?.user){
    const {data:subs}=await sb.from("subscriptions").select("plan_id,status,ends_at").eq("user_id",session.user.id).eq("status","active").order("ends_at",{ascending:false}).limit(1);
    if(subs?.length) status.textContent="عضويتك الحالية: "+subs[0].plan_id+" — تنتهي: "+new Date(subs[0].ends_at).toLocaleDateString("ar-JO");
  }
}else status.textContent="أكمل إعداد Supabase أولاً لعرض حالة العضوية.";
