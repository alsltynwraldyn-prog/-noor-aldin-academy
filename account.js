import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const config = window.ARVYQEN_SUPABASE;
const form = document.querySelector("#auth-form");
const message = document.querySelector("#auth-message");
const title = document.querySelector("#form-title");
const submit = document.querySelector("#submit-btn");
const nameField = document.querySelector("#name");
const passwordField = document.querySelector("#password");
const state = document.querySelector("#account-state");
const actions = document.querySelector("#member-actions");
let mode = "signup";
let supabase = null;

function say(text, error=false) {
  message.textContent = text;
  message.style.color = error ? "#ef8585" : "#75d7ad";
}
function configured() {
  return config && config.url?.startsWith("https://") && !config.url.includes("YOUR-PROJECT") && config.anonKey && !config.anonKey.includes("YOUR_");
}
function setMode(next) {
  mode = next;
  title.textContent = mode === "signup" ? "إنشاء حساب جديد" : "تسجيل الدخول";
  submit.textContent = mode === "signup" ? "إنشاء الحساب" : "دخول";
  nameField.hidden = mode !== "signup";
  nameField.required = mode === "signup";
  passwordField.autocomplete = mode === "signup" ? "new-password" : "current-password";
  document.querySelector("#toggle-mode").textContent = mode === "signup" ? "لديك حساب؟ تسجيل الدخول" : "ليس لديك حساب؟ أنشئ حساباً";
}
function showUser(user) {
  if (!user) {
    state.textContent = "لم يتم تسجيل الدخول.";
    actions.hidden = true;
    return;
  }
  state.textContent = "تم تسجيل الدخول بنجاح.";
  document.querySelector("#member-email").textContent = user.email || "";
  actions.hidden = false;
}
if (!configured()) {
  form.querySelectorAll("input,button").forEach(el => el.disabled = true);
  say("الحسابات جاهزة برمجياً، لكن يلزم وضع رابط مشروع Supabase والمفتاح العام في ملف supabase-config.js أولاً.", true);
  state.textContent = "بانتظار إعداد مشروع المصادقة الآمن.";
} else {
  supabase = createClient(config.url, config.anonKey);
  const { data } = await supabase.auth.getSession();
  showUser(data.session?.user || null);
  supabase.auth.onAuthStateChange((_event, session) => showUser(session?.user || null));
  form.addEventListener("submit", async event => {
    event.preventDefault();
    submit.disabled = true;
    say("جارٍ تنفيذ الطلب...");
    const email = document.querySelector("#email").value.trim();
    const password = passwordField.value;
    try {
      const result = mode === "signup"
        ? await supabase.auth.signUp({email,password,options:{data:{display_name:nameField.value.trim()},emailRedirectTo:location.origin + "/account.html"}})
        : await supabase.auth.signInWithPassword({email,password});
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) say("تم إنشاء الطلب. افتح بريدك الإلكتروني واضغط رابط تأكيد الحساب.");
      else { say("أهلاً بك، تم تسجيل الدخول."); showUser(result.data.user); }
      form.reset();
    } catch (error) { say(error.message || "تعذر إكمال الطلب.", true); }
    finally { submit.disabled = false; }
  });
  document.querySelector("#toggle-mode").addEventListener("click", () => setMode(mode === "signup" ? "login" : "signup"));
  document.querySelector("#reset-password").addEventListener("click", async () => {
    const email = document.querySelector("#email").value.trim();
    if (!email) return say("اكتب بريدك الإلكتروني أولاً.", true);
    const {error} = await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin + "/account.html"});
    say(error ? error.message : "إذا كان البريد مسجلاً، سيصلك رابط استعادة كلمة المرور.", !!error);
  });
  document.querySelector("#sign-out").addEventListener("click", async () => {
    const {error} = await supabase.auth.signOut();
    say(error ? error.message : "تم تسجيل الخروج.", !!error);
  });
}
document.querySelector("#toggle-mode").addEventListener("click", () => { if (!supabase) say("أكمل إعداد Supabase أولاً.", true); });
