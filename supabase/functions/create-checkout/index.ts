import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return reply({error:"Method not allowed"},405);
  const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const serverKey=Deno.env.get("PAYTABS_SERVER_KEY"), profileId=Deno.env.get("PAYTABS_PROFILE_ID"), siteUrl=Deno.env.get("SITE_URL");
  if(!serverKey||!profileId||!siteUrl) return reply({error:"Payment provider is not configured"},503);
  const auth=req.headers.get("Authorization");
  if(!auth?.startsWith("Bearer ")) return reply({error:"Authentication required"},401);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:userError}=await userClient.auth.getUser();
  if(userError||!user) return reply({error:"Invalid session"},401);
  let body:{planId?:string}; try{body=await req.json()}catch{return reply({error:"Invalid JSON"},400)}
  if(!["vip_monthly","vip_yearly"].includes(body.planId||"")) return reply({error:"Invalid plan"},400);
  const admin=createClient(url,service);
  const {data:plan,error:planError}=await admin.from("plans").select("*").eq("id",body.planId).eq("active",true).single();
  if(planError||!plan||!Number.isInteger(plan.amount_minor)||plan.amount_minor<=0||plan.currency!=="JOD") return reply({error:"Plan is not available for purchase"},409);
  const orderId=crypto.randomUUID();
  const amount=Number((plan.amount_minor/1000).toFixed(3));
  const {error:insertError}=await admin.from("orders").insert({id:orderId,user_id:user.id,plan_id:plan.id,amount_minor:plan.amount_minor,currency:"JOD",status:"pending",provider:"paytabs"});
  if(insertError) return reply({error:"Could not create order"},500);
  const origin=siteUrl.replace(/\/$/,"");
  const payload={profile_id:Number(profileId),tran_type:"sale",tran_class:"ecom",cart_id:orderId,cart_description:"ARVYQEN "+plan.name_ar,cart_amount:amount,cart_currency:"JOD",customer_details:{name:user.user_metadata?.display_name||"ARVYQEN learner",email:user.email,country:"JO"},callback:origin+"/functions/v1/paytabs-callback",return:origin+"/payment-return.html"};
  const response=await fetch("https://secure-jordan.paytabs.com/payment/request",{method:"POST",headers:{"Authorization":serverKey,"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.redirect_url||!result.tran_ref){await admin.from("orders").update({status:"failed"}).eq("id",orderId);return reply({error:"Payment provider rejected the checkout request"},502)}
  await admin.from("orders").update({provider_reference:result.tran_ref}).eq("id",orderId);
  return reply({checkoutUrl:result.redirect_url});
});