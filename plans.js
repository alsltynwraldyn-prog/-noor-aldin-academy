import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cfg=window.ARVYQEN_SUPABASE;
const status=document.querySelector("#plan-status");
const buttons=[...document.querySelectorAll("[data-plan]")];
if(cfg?.url?.startsWith("https://") && !cfg.url.includes("YOUR-PROJECT") && cfg.anonKey && !cfg.anonKey.includes("YOUR_")){
  const sb=createClient(cfg.url,cfg.anonKey);
  const [{data:{session}},{data:plans,error}]=await Promise.all([sb.auth.getSession(),sb.from("plans").select("id,name_ar,billing_period,amount_minor,currency,active").eq("active",true)]);
  if(error) status.textContent="تعذر تحميل الباقات. تحقق من إعداد قاعدة البيانات.";
  else if(plans?.length) status.textContent="تم تحميل الباقات المتاحة. سيتم تأكيد الاشتراك بعد التحقق من الدفع.";
  if(session?.user){
    const {data:subs}=await sb.from("subscriptions").select("plan_id,status,ends_at").eq("user_id",session.user.id).eq("status","active").order("ends_at",{ascending:false}).limit(1);
    if(subs?.length) status.textContent="عضويتك الحالية: "+subs[0].plan_id+" — تنتهي: "+new Date(subs[0].ends_at).toLocaleDateString("ar-JO");
  }
  for(const button of buttons){
    const plan=plans?.find(item=>item.id===button.dataset.plan);
    if(!plan||!plan.active||!Number.isInteger(plan.amount_minor)||plan.amount_minor<=0) continue;
    button.disabled=false;
    button.textContent=(session?.user?"اشترك الآن — ":"سجّل الدخول للاشتراك — ")+(plan.amount_minor/1000).toFixed(3)+" د.أ";
    button.addEventListener("click",async()=>{
      if(!session?.user){location.href="account.html";return;}
      button.disabled=true;button.textContent="جارٍ تجهيز الدفع...";
      const {data,error:checkoutError}=await sb.functions.invoke("create-checkout",{body:{planId:plan.id}});
      if(checkoutError||!data?.checkoutUrl){status.textContent=checkoutError?.message||data?.error||"تعذر بدء الدفع. تحقق من إعدادات الخدمة.";button.disabled=false;button.textContent="إعادة المحاولة";return;}
      location.href=data.checkoutUrl;
    });
  }
}else status.textContent="أكمل إعداد Supabase أولاً لعرض حالة العضوية.";
