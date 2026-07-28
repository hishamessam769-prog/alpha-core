import { useEffect, useState } from "react";
import { MessageSquareText, Star, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";

const DAYS_BETWEEN_SURVEYS = 14;

export default function SmartSurvey() {
  const { user } = useAuth();
  const { isArabic } = useLanguage();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [triggerContext, setTriggerContext] = useState("timed");

  const storageKey = user ? `alpha-survey-last-shown-${user.id}` : "";
  const isEligible = () => {
    const last = Number(window.localStorage.getItem(storageKey) || 0);
    return !last || Date.now() - last > DAYS_BETWEEN_SURVEYS * 86400000;
  };

  const show = (context) => {
    if (!user || open || !isEligible()) return;
    setTriggerContext(context);
    setOpen(true);
    window.localStorage.setItem(storageKey, String(Date.now()));
  };

  useEffect(() => {
    if (!user) return undefined;
    const timer = window.setTimeout(() => show("timed_engagement"), 60000);
    const onAction = () => window.setTimeout(() => show("completed_action"), 1200);
    window.addEventListener("alpha:meaningful-action", onAction);
    return () => { window.clearTimeout(timer); window.removeEventListener("alpha:meaningful-action", onAction); };
  }, [user?.id]);

  const submit = async (event) => {
    event.preventDefault();
    if (!rating || saving) return;
    setSaving(true);
    setErrorMessage("");
    const { error } = await supabase.from("survey_responses").insert({
      user_id: user.id,
      rating,
      feedback: feedback.trim() || null,
      trigger_context: triggerContext,
      page_path: location.pathname,
    });
    setSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setOpen(false);
    setRating(0);
    setFeedback("");
  };

  if (!open) return null;
  return (
    <div className="survey-popover" role="dialog" aria-modal="false">
      <button className="survey-close" type="button" onClick={() => setOpen(false)}><X size={15}/></button>
      <span className="survey-icon"><MessageSquareText size={19}/></span>
      <span className="eyebrow">QUICK FEEDBACK</span>
      <h3>{isArabic ? "تجربتك مع ALPHA عاملة إيه؟" : "How is your ALPHA experience?"}</h3>
      <p>{isArabic ? "اختار تقييم سريع. التعليق اختياري ولن يأخذ أكثر من دقيقة." : "Choose a quick rating. The comment is optional and takes less than a minute."}</p>
      <form onSubmit={submit}>
        <div className="survey-stars" role="radiogroup" aria-label="Rating">{[1,2,3,4,5].map((value) => <button type="button" className={rating >= value ? "active" : ""} onClick={() => setRating(value)} key={value} aria-label={`${value} star`}><Star size={22}/></button>)}</div>
        <textarea rows="2" maxLength="1000" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder={isArabic ? "إيه أكتر حاجة نقدر نحسنها؟" : "What is the one thing we should improve?"}/>
        {errorMessage && <div className="survey-error-v31">{errorMessage}</div>}
        <button className="button gold full" disabled={!rating || saving}>{saving ? (isArabic ? "جاري الحفظ" : "Saving") : (isArabic ? "إرسال التقييم" : "Submit feedback")}</button>
      </form>
    </div>
  );
}
