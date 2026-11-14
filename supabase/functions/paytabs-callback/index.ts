import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
Deno.serve(async req=>{
  if(req.method!=="POST") return reply({error:"Method not allowed"},405);
  const url=Deno.env.get("SUPABASE_URL")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,serverKey=Deno.env.get("PAYTABS_SERVER_KEY"),profileId=Deno.env.get("PAYTABS_PROFILE_ID");
  if(!serverKey||!profileId) return reply({error:"Not configured"},503);
  const payload=await req.json().catch(()=>null);
  const cartId=String(payload?.cart_id||""),tranRef=String(payload?.tran_ref||"");
  if(!cartId||!tranRef) return reply({error:"Missing transaction reference"},400);
  const admin=createClient(url,service);
  const {data:order}=await admin.from("orders").select("*,plans(*)").eq("id",cartId).single();
  if(!order) return reply({error:"Order not found"},404);
  if(order.status==="paid") return reply({received:true});
  if(order.provider_reference&&order.provider_reference!==tranRef) return reply({error:"Transaction reference mismatch"},400);
  const verify=await fetch("https://secure-jordan.paytabs.com/payment/query",{method:"POST",headers:{"Authorization":serverKey,"Content-Type":"application/json"},body:JSON.stringify({profile_id:Number(profileId),tran_ref:tranRef})});
  const transaction=await verify.json().catch(()=>({}));
  const paid=verify.ok&&transaction.payment_result?.response_status==="A"&&transaction.cart_id===order.id&&transaction.cart_currency==="JOD"&&Math.round(Number(transaction.cart_amount)*1000)===order.amount_minor;
  if(!paid) {
    if(transaction.payment_result?.response_status==="D"||transaction.payment_result?.response_status==="C") await admin.from("orders").update({status:"failed"}).eq("id",order.id).neq("status","paid");
    return reply({received:true,verified:false});
  }
  const now=new Date(),end=new Date(now);
  if(order.plan_id==="vip_monthly") end.setMonth(end.getMonth()+1); else if(order.plan_id==="vip_yearly") end.setFullYear(end.getFullYear()+1); else return reply({error:"Unknown plan"},400);
  const {error:updateError}=await admin.from("orders").update({status:"paid",paid_at:now.toISOString(),provider_reference:tranRef}).eq("id",order.id).neq("status","paid");
  if(updateError) return reply({error:"Could not record payment"},500);
  const {error:subError}=await admin.from("subscriptions").upsert({user_id:order.user_id,plan_id:order.plan_id,status:"active",starts_at:now.toISOString(),ends_at:end.toISOString(),provider:"paytabs",provider_reference:tranRef,order_id:order.id},{onConflict:"order_id",ignoreDuplicates:true});
  if(subError) return reply({error:"Payment verified; membership activation needs reconciliation"},500);
  return reply({received:true,verified:true});
});