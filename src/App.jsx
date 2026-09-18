
import { useEffect, useRef, useState } from "react" 
import { supabase } from "./supabase"
import { brandImages, mealFallbackImage } from "./brandMedia"
import "./App.css"
const plans = [
  { id: 1, days: 26, meals: 1, price: 90 },
  { id: 2, days: 26, meals: 2, price: 165 },
  { id: 3, days: 26, meals: 3, price: 220 },
  { id: 4, days: 20, meals: 1, price: 70 },
  { id: 5, days: 20, meals: 2, price: 110 },
  { id: 6, days: 20, meals: 3, price: 165 },
]
const DAILY_PRICE = 3
const DAILY_DEFAULT_MEAL_COUNT = 4
const DEFAULT_SITE_SETTINGS = {
  slogan: "أكل البيت... بطابع براند عالمي",
  contact_phone: "",
  whatsapp_phone: "",
  instagram_url: "",
  facebook_url: "",
  hero_image_url: "",
  circle_image_url: "",
  story_image_url: "",
  cta_image_url: "",
  footer_meal_images: [],
  menu_publish_time: "12:00",
  menu_stop_time: "23:00",
  daily_delivery_fee: 1,
  timezone: "Asia/Amman",
}
function formatDateLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
function getAmmanNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date())
  const get = (type) => parts.find((part) => part.type === type)?.value || "00"
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  }
}
function timeToMinutes(value) {
  const [h, m] = String(value || "00:00").split(":").map(Number)
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}
function isWithinTimeWindow(start, stop, minutes) {
  const s = timeToMinutes(start)
  const e = timeToMinutes(stop)
  if (s === e) return true
  return s < e ? minutes >= s && minutes <= e : minutes >= s || minutes <= e
}
function getNextSubscriberDate(baseDate = new Date()) {
  const d = new Date(baseDate)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 1)
  // الجمعة عطلة: المشترك يختار السبت مباشرة.
  if (d.getDay() === 5) d.setDate(d.getDate() + 1)
  return formatDateLocal(d)
}
const FOOTER_MEAL_IMAGES = [
  "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1551183053-bf71b1e09e2d?auto=format&fit=crop&w=1200&q=80",
]
function getToday() {
  const now = new Date()
  return (
    `${now.getFullYear()}-` +
    `${String(now.getMonth() + 1).padStart(2, "0")}-` +
    `${String(now.getDate()).padStart(2, "0")}`
  )
  
}
/* ======================================================
   LOCATION
====================================================== */
function getCustomerLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        latitude: null,
        longitude: null,
      })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      () => {
        resolve({
          latitude: null,
          longitude: null,
        })
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  })
}
/* ======================================================
   APP
====================================================== */
function SubscriberPage({
  subscription,
  availableMeals = [],
  tomorrowAvailableMeals = [],
  onClose,
}) {
  const [dailyMeals, setDailyMeals] = useState([])
  const [selectionMeals, setSelectionMeals] = useState([])
  const [selectionDate, setSelectionDate] = useState(null)
  const [selectedMeals, setSelectedMeals] = useState({})
  const [loadingDaily, setLoadingDaily] = useState(true)
  const [savingMeals, setSavingMeals] = useState(false)
  const [dailyNote, setDailyNote] = useState("")
  const today = new Date()
const todayDate = getToday()

const tomorrow = new Date(today)
tomorrow.setDate(today.getDate() + 1)

const tomorrowDate = formatDate(tomorrow)

const date = today.toLocaleDateString("ar-JO", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

const weekday = today.toLocaleDateString("ar-JO", {
  weekday: "long",
})

const tomorrowWeekday = tomorrow.toLocaleDateString("ar-JO", {
  weekday: "long",
})

const isFriday = today.getDay() === 5

function formatDate(dateValue) {
  return `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, "0")}-${String(dateValue.getDate()).padStart(2, "0")}`
}
  useEffect(() => {
    const loadDailyMeals = async () => {
      if (!subscription?.id) return
      setLoadingDaily(true)
      try {
        const { data: allRows, error: allError } = await supabase
          .from("subscription_daily_meals")
          .select("*")
          .eq("subscription_id", subscription.id)
          .order("meal_date", { ascending: true })
          .order("created_at", { ascending: true })
        if (allError) {
          console.error("SUBSCRIBER DAILY MEALS ERROR:", allError)
          setDailyMeals([])
          setSelectionMeals([])
          setSelectionDate(todayDate)
          return
        }
        const rows = allRows || []
        const todayRows = rows.filter((item) => item.meal_date === todayDate)
setDailyMeals(todayRows)

// المشترك يختار وجبات الغد مسبقاً.
const selectionDateValue = tomorrowDate
setSelectionDate(selectionDateValue)

// نعرض للمشترك وجبات الغد المنشورة من الإدارة.
setSelectionMeals((tomorrowAvailableMeals || []).filter(Boolean))

const selectedRows = rows.filter(
  (item) => item.meal_date === selectionDateValue
)
        const selected = {}
        selectedRows.forEach((item) => {
          if (item.meal_id) selected[item.meal_id] = Number(item.quantity || 1)
        })
        setSelectedMeals(selected)
        setDailyNote(selectedRows[0]?.notes || "")
        // إجمالي الوجبات المستخدمة = الوجبات المسجلة حتى تاريخ اليوم فقط.
        const used = rows
          .filter((item) => item.meal_date && item.meal_date <= todayDate)
          .reduce((sum, item) => sum + Number(item.quantity || 0), 0)
        const total = Number(subscription.total_meals || Number(subscription.plan_days || 0) * Number(subscription.meals_per_day || 0))
        const remaining = Math.max(0, total - used)
        setSubscriptionStats({ used, remaining })
      } finally {
        setLoadingDaily(false)
      }
    }
    loadDailyMeals()
  }, [subscription?.id, todayDate, tomorrowDate, tomorrowAvailableMeals])
  const [subscriptionStats, setSubscriptionStats] = useState({ used: 0, remaining: 0 })
  const selectionDateObject = selectionDate ? new Date(`${selectionDate}T00:00:00`) : new Date()
  const selectionText = selectionDateObject.toLocaleDateString("ar-JO", { day: "numeric", month: "long", year: "numeric" })
  const selectionWeekday = selectionDateObject.toLocaleDateString("ar-JO", { weekday: "long" })
  const selectionMealsCount = Object.values(selectedMeals).reduce((sum, quantity) => sum + Number(quantity || 0), 0)
  const selectionRemaining = Math.max(0, Number(subscription?.meals_per_day || 0) - selectionMealsCount)
  const changeMealQuantity = (mealId, change) => {
    setSelectedMeals((prev) => {
      const current = Number(prev[mealId] || 0)
      const max = Number(subscription?.meals_per_day || 0)
      let next = Math.max(0, Math.min(max, current + change))
      const totalOther = Object.entries(prev)
        .filter(([id]) => String(id) !== String(mealId))
        .reduce((sum, [, quantity]) => sum + Number(quantity || 0), 0)
      if (totalOther + next > max) next = Math.max(0, max - totalOther)
      const result = { ...prev }
      if (next === 0) delete result[mealId]
      else result[mealId] = next
      return result
    })
  }
  const saveTomorrowMeals = async () => {
    if (!subscription?.id || !selectionDate) return
    const maxMeals = Number(subscription.meals_per_day || 0)
    if (selectionMealsCount !== maxMeals) {
      alert(`يجب اختيار ${maxMeals} وجبة ليوم ${selectionWeekday}`)
      return
    }
    setSavingMeals(true)
    try {
      const rows = Object.entries(selectedMeals).map(([mealId, quantity]) => {
        const meal = selectionMeals.find((item) => String(item.id) === String(mealId))
        return meal ? {
          meal_id: meal.id,
          meal_name: meal.name,
          quantity: Number(quantity),
          notes: dailyNote.trim() || null,
        } : null
      }).filter(Boolean)
      if (!rows.length) {
        alert("اختر الوجبات أولاً")
        return
      }
      // الحفظ عبر RPC موثوق وآمن: الدالة تتحقق من tracking_token ثم تستبدل اختيارات اليوم.
      const { error } = await supabase.rpc("save_subscription_daily_meals", {
        p_subscription_id: subscription.id,
        p_tracking_token: subscription.tracking_token,
        p_meal_date: selectionDate,
        p_meals: rows,
      })
      if (error) {
        console.error("SAVE SUBSCRIBER MEALS RPC ERROR:", error)
        alert(`تعذر حفظ وجباتك حالياً. تأكد من تشغيل ملف SQL المرفق مرة واحدة في Supabase.\n\n${error.message || "خطأ غير معروف"}`)
        return
      }
      const savedRows = rows.map((row) => ({ ...row, subscription_id: subscription.id, meal_date: selectionDate }))
      if (selectionDate === todayDate) setDailyMeals(savedRows)
      setSelectionMeals(selectionMeals)
      localStorage.removeItem(`chefNoorMeals:${subscription.id}:${selectionDate}`)
      alert("تم حفظ وجباتك بنجاح ✅")
    } catch (error) {
      console.error("SAVE TOMORROW MEALS ERROR:", error)
      alert("حدث خطأ أثناء حفظ الوجبات")
    } finally {
      setSavingMeals(false)
    }
  }
  const trackingUrl =
    subscription?.trackingUrl ||
    `${window.location.origin}/?tracking=${subscription?.tracking_token}`
  const copyTrackingLink = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl)
      alert("تم نسخ رابط المتابعة ✅")
    } catch (error) {
      console.error(error)
      alert("تعذر نسخ الرابط")
    }
  }
  return (
    <section className="subscriber-page section">
      <div className="subscriber-card">
        <div className="subscriber-success">
          <span>✓</span>
          <h2>تم تسجيل اشتراكك بنجاح</h2>
          <p>
            أهلاً وسهلاً {subscription?.customer_name}
          </p>
        </div>
        <div className="subscriber-today-box">
          <strong>{weekday}</strong>
          <div>{date}</div>
          {isFriday && (
            <p>
              اليوم الجمعة عطلة المطبخ
            </p>
          )}
        </div>
        <div className="tracking-box">
          <strong>
            رقم متابعة الاشتراك
          </strong>
          <div className="tracking-token">
            {subscription?.tracking_token}
          </div>
          <button
            type="button"
            onClick={copyTrackingLink}
          >
            نسخ رابط المتابعة
          </button>
          <small>
            احتفظ بهذا الرابط لمتابعة اشتراكك
          </small>
        </div>
        <div className="subscription-summary">
          <div>
            <span>مدة الاشتراك</span>
            <strong>
              {subscription?.plan_days} يوم
            </strong>
          </div>
          <div>
            <span>وجبات يومياً</span>
            <strong>
              {subscription?.meals_per_day}
            </strong>
          </div>
          <div>
            <span>إجمالي الوجبات</span>
            <strong>
              {subscription?.total_meals}
            </strong>
          </div>
          <div>
            <span>المستخدم</span>
            <strong>
              {subscriptionStats.used}
            </strong>
          </div>
          <div>
            <span>المتبقي</span>
            <strong>
              {subscriptionStats.remaining}
            </strong>
          </div>
        </div>
        <div className="today-meals-box">
          <strong>وجبات اليوم</strong>
          {loadingDaily ? (
            <p>جاري تحميل وجباتك...</p>
          ) : dailyMeals.length === 0 ? (
            <p>لم يتم اختيار وجبات لليوم بعد.</p>
          ) : (
            <>
              <div>المستخدم حتى اليوم: <strong>{subscriptionStats.used}</strong></div>
              <div>المتبقي من الاشتراك: <strong>{subscriptionStats.remaining}</strong></div>
            </>
          )}
        </div>
        <div className="subscriber-meal-selection">
          <div className="section-title">
            <small>اختيار وجبات الغد</small>
<h3>اختر وجبات {selectionWeekday}</h3>
            <h3>اختر وجبات {selectionWeekday}</h3>
            <p>{selectionText}</p>
          </div>
          <div className="meal-selection-counter">
            <strong>اخترت {selectionMealsCount} من {subscription?.meals_per_day || 0}</strong>
            <span>المتبقي للاختيار: {selectionRemaining}</span>
          </div>
          {selectionMeals.length === 0 ? (
            <div className="empty-state">
  لا توجد وجبات منشورة لـ {selectionWeekday} حالياً.
</div>
          ) : (
            <div className="subscriber-meals-grid">
              {selectionMeals.map((meal, index) => {
                const quantity = Number(selectedMeals[meal.id] || 0)
                return (
                  <div key={meal.id} className={`subscriber-meal-card ${quantity > 0 ? "selected" : ""}`}>
                    <img src={meal.image_url || mealFallbackImage(index)} alt={meal.name} />
                    <div className="subscriber-meal-info">
                      <strong>{meal.name}</strong>
                      <p>{meal.description || "وجبة منزلية طازجة محضّرة بعناية."}</p>
                    </div>
                    <div className="meal-quantity-control">
                      <button type="button" onClick={() => changeMealQuantity(meal.id, -1)} disabled={quantity === 0}>−</button>
                      <strong>{quantity}</strong>
                      <button type="button" onClick={() => changeMealQuantity(meal.id, 1)} disabled={selectionMealsCount >= Number(subscription?.meals_per_day || 0) || quantity >= 1}>+</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <textarea className="subscriber-note-input" placeholder="ملاحظة لهذا اليوم (اختياري): كمية الطعام، وزن الكربوهيدرات، مكوّن لا ترغب به أو أي طلب خاص." value={dailyNote} onChange={(e) => setDailyNote(e.target.value)} />
          <button type="button" className="primary-btn" onClick={saveTomorrowMeals} disabled={savingMeals || selectionMealsCount !== Number(subscription?.meals_per_day || 0)}>
            {savingMeals ? "جاري الحفظ..." : "حفظ وجباتي"}
          </button>
        </div>
        {/* =========================================
            وجبات اليوم المحفوظة
        ========================================= */}
        <div className="daily-meals-list">
          <strong>
            وجباتك اليوم
          </strong>
          {loadingDaily ? (
            <p>
              جاري التحميل...
            </p>
          ) : dailyMeals.length === 0 ? (
            <p>
              لم يتم تسجيل وجبات لهذا اليوم.
            </p>
          ) : (
            dailyMeals.map((item) => (
              <div
                key={item.id}
                className="daily-meal-item"
              >
                <span>
                  {item.meal_name}
                </span>
                <strong>
                  × {item.quantity}
                </strong>
              </div>
            ))
          )}
        </div>
        <button
          type="button"
          className="secondary-btn"
          onClick={onClose}
        >
          العودة للموقع
        </button>
      </div>
    </section>
  )
}
function App() {
  const [page, setPage] = useState("home")
  const [subscriberData, setSubscriberData] = useState(null)
const [subscriberLoading, setSubscriberLoading] = useState(false)
  const [adminPage, setAdminPage] = useState("overview")
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [siteSettings, setSiteSettings] = useState(DEFAULT_SITE_SETTINGS)
  const [siteSettingsSaving, setSiteSettingsSaving] = useState(false)
  const [siteSettingsLoaded, setSiteSettingsLoaded] = useState(false)
  useEffect(() => {
  const tracking = new URLSearchParams(window.location.search).get("tracking")
  if (!tracking) return
  const loadTrackedSubscriber = async () => {
    setSubscriberLoading(true)
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("tracking_token", tracking)
        .maybeSingle()
      if (error) {
        console.error("TRACKING LOAD ERROR:", error)
        alert("تعذر تحميل بيانات الاشتراك")
        return
      }
      if (!data) {
        alert("رابط المتابعة غير صحيح أو غير موجود")
        return
      }
      setSubscriberData({
        ...data,
        trackingUrl:
          `${window.location.origin}/?tracking=${data.tracking_token}`,
      })
      setPage("subscriber")
    } catch (error) {
      console.error("TRACKING ERROR:", error)
      alert("حدث خطأ أثناء تحميل بيانات الاشتراك")
    } finally {
      setSubscriberLoading(false)
    }
  }
  loadTrackedSubscriber()
}, [])
  
  /* ======================================================
     ADMIN LOGIN
  ====================================================== */
const loginAdmin = async (email, password) => {
  try {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })
    if (error) {
      alert(
        "فشل تسجيل الدخول:\n" +
          error.message
      )
      return false
    }
    if (!data.user) {
      alert("لم يتم العثور على المستخدم")
      return false
    }
    const {
      data: profileData,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single()
    if (profileError) {
      console.error(
        "PROFILE ERROR:",
        profileError
      )
      alert(
        "تم تسجيل الدخول لكن لم يتم العثور على بيانات الحساب."
      )
      await supabase.auth.signOut()
      return false
    }
    setUser(data.user)
    setProfile(profileData)
    /* =========================
       توجيه حسب الصلاحية
    ========================= */
    if (profileData.role === "admin") {
      setPage("admin")
    } else if (profileData.role === "kitchen") {
      setPage("kitchen")
    } else if (profileData.role === "driver") {
      setPage("delivery")
    } else if (
      profileData.role === "subscriber"
    ) {
      setPage("subscriptions")
    } else if (
      profileData.role === "customer"
    ) {
      setPage("daily")
    } else {
      alert(
        "صلاحية الحساب غير معروفة."
      )
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      return false
    }
    return true
  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    )
    alert(
      "حدث خطأ أثناء تسجيل الدخول."
    )
    return false
  }
}
  /* ======================================================
     CUSTOMER
  ====================================================== */
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerAddress, setCustomerAddress] = useState("")
  const [customerLocation, setCustomerLocation] = useState({ latitude: null, longitude: null })
  const [customerMapLink, setCustomerMapLink] = useState("")
  const [customerNote, setCustomerNote] = useState("")
  const [checkoutSaving, setCheckoutSaving] = useState(false)
  /* ======================================================
     SUBSCRIPTION
  ====================================================== */
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [editingSubscription, setEditingSubscription] =
    useState(null)
  const [isSaving, setIsSaving] = useState(false)
  /* ======================================================
     DAILY ORDER
  ====================================================== */
  const [dailyOrderOpen, setDailyOrderOpen] =
    useState(false)
  const [dailyQuantity, setDailyQuantity] =
    useState(1)
  const [selectedDailyMeal, setSelectedDailyMeal] =
    useState(null)
  const [dailySaving, setDailySaving] =
    useState(false)
    const [cart, setCart] = useState([])
const [cartOpen, setCartOpen] = useState(false)
const [checkoutOpen, setCheckoutOpen] = useState(false)
const [feedbackOpen, setFeedbackOpen] = useState(false)
const cartItemsCount = cart.reduce(
  (sum, item) => sum + Number(item.quantity || 0),
  0
)
const cartItemsTotal = cart.reduce(
  (sum, item) => sum + Number(item.total || 0),
  0
)
const cartDeliveryTotal = cart.some((item) => item.kind !== "subscription") ? Number(siteSettings.daily_delivery_fee ?? 1) : 0
const cartSubtotal = cartItemsTotal + cartDeliveryTotal
  /* ======================================================
     DASHBOARD
  ====================================================== */
  const [dashboard, setDashboard] = useState({
    subscriberMeals: 0,
    dailyMeals: 0,
    totalMeals: 0,
  })
  const [subscriptions, setSubscriptions] =
    useState([])
  const [dailyOrders, setDailyOrders] =
    useState([])
const [subscriberDailyMeals, setSubscriberDailyMeals] = useState([])
  const [adminDailyMenu, setAdminDailyMenu] = useState({ today: null, tomorrow: null })
  const [loadingAdminDailyMenu, setLoadingAdminDailyMenu] = useState(false)
  const [menuMonth, setMenuMonth] = useState(null)
  const [menuDays, setMenuDays] = useState([])
  const [loadingMenuPlan, setLoadingMenuPlan] = useState(false)
  const [savingMenuDay, setSavingMenuDay] = useState(null)
  const [menuView, setMenuView] = useState("planner")
  const [publishedDailyMenu, setPublishedDailyMenu] = useState(null)
  const [publishedTomorrowMenu, setPublishedTomorrowMenu] = useState(null)
  const [publishedSubscriberMenu, setPublishedSubscriberMenu] = useState(null)
  const [loadingPublishedMenu, setLoadingPublishedMenu] = useState(false)
  const [loadingDashboard, setLoadingDashboard] =
    useState(false)
  /* ======================================================
     MEALS
     مهم جداً:
     meals لازم تكون داخل App
  ====================================================== */
  const [meals, setMeals] = useState([])
  const [loadingMeals, setLoadingMeals] =
    useState(false)
  const [mealFormOpen, setMealFormOpen] =
    useState(false)
  const [editingMeal, setEditingMeal] =
    useState(null)
  const [mealSaving, setMealSaving] =
    useState(false)
  const [deletingMeal, setDeletingMeal] =
    useState(null)
  /* ======================================================
     UPDATING
  ====================================================== */
  const [updatingOrder, setUpdatingOrder] =
    useState(null)
  const [updatingSubscription, setUpdatingSubscription] =
    useState(null)
  /* ======================================================
     AVAILABLE MEALS
     نحسبها من meals
  ====================================================== */
  const availableMeals = meals.filter(
    (meal) =>
      meal.active &&
      meal.is_available
  )
  const useCustomerLocation = async () => {
    const location = await getCustomerLocation()
    if (location.latitude != null && location.longitude != null) {
      setCustomerLocation(location)
      return true
    }
    alert("تعذر تحديد موقعك. يمكنك المتابعة وكتابة عنوان السكن بالتفصيل، أو فتح Google Maps واستخدامه يدويًا.")
    return false
  }
  /* ======================================================
     LOAD MEALS
  ====================================================== */
  const loadMeals = async () => {
    setLoadingMeals(true)
    try {
      const {
        data,
        error,
      } = await supabase
        .from("meals")
        .select("*")
        .order("id", {
          ascending: false,
        })
      if (error) {
        console.error(
          "LOAD MEALS ERROR:",
          error
        )
        alert(
          "حدث خطأ أثناء تحميل الوجبات:\n" +
            error.message
        )
        return
      }
      setMeals(data || [])
    } catch (error) {
      console.error(error)
      alert(
        "حدث خطأ في الاتصال بقاعدة البيانات"
      )
    } finally {
      setLoadingMeals(false)
    }
  }
  /* ======================================================
     SAVE MEAL
  ====================================================== */
  const saveMeal = async (form) => {
    if (!form.name.trim()) {
      alert("يرجى كتابة اسم الوجبة")
      return
    }
    setMealSaving(true)
    try {
      const mealData = {
        name: form.name.trim(),
        description:
          form.description?.trim() || null,
        image_url:
          form.image_url?.trim() || null,
        price:
          Number(form.price) || 0,
        active:
          Boolean(form.active),
        is_available:
          Boolean(form.is_available),
      }
      let error = null
      if (editingMeal) {
        const result = await supabase
          .from("meals")
          .update(mealData)
          .eq("id", editingMeal.id)
        error = result.error
      } else {
        const result = await supabase
          .from("meals")
          .insert(mealData)
        error = result.error
      }
      if (error) {
        console.error(
          "MEAL SAVE ERROR:",
          error
        )
        alert(
          "حدث خطأ أثناء حفظ الوجبة:\n" +
            error.message
        )
        return
      }
      alert(
        editingMeal
          ? "تم تعديل الوجبة بنجاح ✅"
          : "تمت إضافة الوجبة بنجاح ❤️"
      )
      setMealFormOpen(false)
      setEditingMeal(null)
      await loadMeals()
    } catch (error) {
      console.error(error)
      alert(
        "حدث خطأ في الاتصال بقاعدة البيانات"
      )
    } finally {
      setMealSaving(false)
    }
  }
  /* ======================================================
     OPEN ADD MEAL
  ====================================================== */
  const openAddMeal = () => {
    setEditingMeal(null)
    setMealFormOpen(true)
  }
  /* ======================================================
     OPEN EDIT MEAL
  ====================================================== */
  const openEditMeal = (meal) => {
    setEditingMeal(meal)
    setMealFormOpen(true)
  }
  /* ======================================================
     DELETE MEAL
  ====================================================== */
  const deleteMeal = async (meal) => {
    const confirmed =
      window.confirm(
        `هل أنت متأكد من حذف الوجبة "${meal.name}"؟`
      )
    if (!confirmed) {
      return
    }
    setDeletingMeal(meal.id)
    try {
      const {
        error,
      } = await supabase
        .from("meals")
        .delete()
        .eq("id", meal.id)
      if (error) {
        console.error(error)
        alert(
          "حدث خطأ أثناء حذف الوجبة:\n" +
            error.message
        )
        return
      }
      alert(
        "تم حذف الوجبة بنجاح ✅"
      )
      await loadMeals()
    } catch (error) {
      console.error(error)
      alert(
        "حدث خطأ في الاتصال بقاعدة البيانات"
      )
    } finally {
      setDeletingMeal(null)
    }
  }
  /* ======================================================
     TOGGLE MEAL
  ====================================================== */
  const toggleMeal = async (meal) => {
    try {
      const newActive =
        !Boolean(meal.active)
      const {
        error,
      } = await supabase
        .from("meals")
        .update({
          active: newActive,
          is_available: newActive,
        })
        .eq("id", meal.id)
      if (error) {
        console.error(error)
        alert(
          "حدث خطأ أثناء تغيير حالة الوجبة:\n" +
            error.message
        )
        return
      }
      await loadMeals()
    } catch (error) {
      console.error(error)
      alert(
        "حدث خطأ في الاتصال بقاعدة البيانات"
      )
    }
  }
  /* ======================================================
     TOGGLE AVAILABILITY
  ====================================================== */
  const toggleMealAvailability = async (
    meal
  ) => {
    try {
      const {
        error,
      } = await supabase
        .from("meals")
        .update({
          is_available:
            !Boolean(
              meal.is_available
            ),
        })
        .eq("id", meal.id)
      if (error) {
        console.error(error)
        alert(
          "حدث خطأ أثناء تغيير توفر الوجبة:\n" +
            error.message
        )
        return
      }
      await loadMeals()
    } catch (error) {
      console.error(error)
      alert(
        "حدث خطأ في الاتصال بقاعدة البيانات"
      )
    }
  }
  /* ======================================================
     30-DAY MENU PLANNER
     عند فتح قسم الوجبات نجهز دورة 30 يوم تلقائياً
  ====================================================== */
  const getMonthMeta = (startDate) => {
    const d = new Date(`${startDate}T00:00:00`)
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    }
  }
  const loadMenuPlan = async () => {
    setLoadingMenuPlan(true)
    try {
      const today = new Date()
      const todayText = formatDateLocal(today)
      let { data: monthData, error: monthError } = await supabase
        .from("menu_months")
        .select("*")
        .eq("status", "draft")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (monthError) throw monthError
      if (!monthData) {
        const meta = getMonthMeta(todayText)
        const { data: createdMonth, error: createError } = await supabase
          .rpc("create_menu_month", {
            p_name: `قائمة 30 يوم - ${today.toLocaleDateString("ar-JO", { day: "numeric", month: "long", year: "numeric" })}`,
            p_year: meta.year,
            p_month: meta.month,
            p_start_date: todayText,
          })
        if (createError) throw createError
        const newId = Number(createdMonth)
        const { data: freshMonth, error: freshMonthError } = await supabase
          .from("menu_months")
          .select("*")
          .eq("id", newId)
          .single()
        if (freshMonthError) throw freshMonthError
        monthData = freshMonth
      }
      const { data: daysData, error: daysError } = await supabase
        .from("daily_menu")
        .select("id, month_id, day_number, menu_date, is_holiday, is_published, notes")
        .eq("month_id", monthData.id)
        .order("day_number", { ascending: true })
      if (daysError) throw daysError
      // الجمعة عطلة حسب التاريخ الفعلي، وليس حسب رقم اليوم داخل الدورة.
      const normalizedDays = (daysData || []).map((day) => ({
        ...day,
        is_holiday: new Date(`${day.menu_date}T00:00:00`).getDay() === 5,
      }))
      const holidayChanges = normalizedDays.filter(
        (day, index) => day.is_holiday !== (daysData[index]?.is_holiday ?? false)
      )
      for (const day of holidayChanges) {
        const { error: holidayError } = await supabase
          .from("daily_menu")
          .update({ is_holiday: day.is_holiday })
          .eq("id", day.id)
        if (holidayError) throw holidayError
      }
      const actualHolidayIds = normalizedDays
        .filter((day) => day.is_holiday)
        .map((day) => day.id)
      if (actualHolidayIds.length) {
        const { error: holidayItemsError } = await supabase
          .from("daily_menu_items")
          .delete()
          .in("daily_menu_id", actualHolidayIds)
        if (holidayItemsError) throw holidayItemsError
      }
      const dayIds = normalizedDays.map((d) => d.id)
      let itemsData = []
      if (dayIds.length) {
        const { data, error } = await supabase
          .from("daily_menu_items")
          .select("id, daily_menu_id, meal_id, display_order, available, meals(id, name, image_url, price)")
          .in("daily_menu_id", dayIds)
          .order("display_order", { ascending: true })
        if (error) throw error
        itemsData = data || []
      }
      const { data: freshMeals, error: freshMealsError } = await supabase
        .from("meals")
        .select("*")
        .eq("active", true)
        .eq("is_available", true)
        .order("id", { ascending: true })
      if (freshMealsError) throw freshMealsError
      const available = freshMeals || []
      setMeals(available)
      const draftRows = []
      let mealCursor = 0
      for (const day of normalizedDays) {
        if (day.is_holiday) continue
        const existing = itemsData
          .filter((item) => item.daily_menu_id === day.id)
          .sort((a, b) => a.display_order - b.display_order)
        const usedMealIds = new Set(existing.map((item) => Number(item.meal_id)))
        let slot = existing.length + 1
        while (slot <= DAILY_DEFAULT_MEAL_COUNT && available.length > usedMealIds.size) {
          let found = null
          let attempts = 0
          while (attempts < available.length) {
            const candidate = available[mealCursor % available.length]
            mealCursor += 1
            attempts += 1
            if (!usedMealIds.has(Number(candidate.id))) {
              found = candidate
              break
            }
          }
          if (!found) break
          usedMealIds.add(Number(found.id))
          draftRows.push({
            daily_menu_id: day.id,
            meal_id: found.id,
            display_order: slot,
            available: true,
          })
          slot += 1
        }
      }
      if (draftRows.length) {
        const { error: seedError } = await supabase
          .from("daily_menu_items")
          .insert(draftRows)
        if (seedError) throw seedError
        const { data, error } = await supabase
          .from("daily_menu_items")
          .select("id, daily_menu_id, meal_id, display_order, available, meals(id, name, image_url, price)")
          .in("daily_menu_id", dayIds)
          .order("display_order", { ascending: true })
        if (error) throw error
        itemsData = data || []
      }
      // مهم: تجهيز القائمة لا يعني نشرها.
      // المدير وحده يقرر متى ينشر اليوم، حتى تبقى قائمة الغد مخفية
      // عن الزوار والمشتركين إلى أن تصبح جاهزة وضمن نافذة العرض.
      setMenuMonth(monthData)
      setMenuDays(normalizedDays.map((day) => ({
        ...day,
        items: itemsData.filter((item) => item.daily_menu_id === day.id).sort((a, b) => a.display_order - b.display_order),
      })))
    } catch (error) {
      console.error("MENU PLAN ERROR:", error)
      alert("حدث خطأ أثناء تجهيز جدول الـ30 يوم:\n" + error.message)
    } finally {
      setLoadingMenuPlan(false)
    }
  }
  const updateMenuDayLocal = (dayId, slot, mealId) => {
    const meal =
      meals.find((m) => String(m.id) === String(mealId)) ||
      menuDays
        .flatMap((day) => day.items || [])
        .map((item) => item.meals)
        .find((m) => m && String(m.id) === String(mealId))
    setMenuDays((prev) =>
      prev.map((day) => {
        if (Number(day.id) !== Number(dayId)) return day
        const items = [...(day.items || [])]
        const index = Math.max(0, Number(slot) - 1)
        if (index >= items.length) return day
        if (!mealId) {
          items.splice(index, 1)
        } else if (meal) {
          const duplicateIndex = items.findIndex(
            (item, i) =>
              i !== index &&
              String(item.meal_id) === String(meal.id)
          )
          if (duplicateIndex >= 0) {
            alert("لا يمكن تكرار نفس الوجبة في اليوم نفسه.")
            return day
          }
          items[index] = {
            ...items[index],
            daily_menu_id: day.id,
            meal_id: meal.id,
            display_order: index + 1,
            available: true,
            meals: meal,
          }
        }
        return {
          ...day,
          items: items.map((item, i) => ({
            ...item,
            display_order: i + 1,
          })),
        }
      })
    )
  }
  const addMenuDaySlot = (dayId) => {
    setMenuDays((prev) =>
      prev.map((day) => {
        if (Number(day.id) !== Number(dayId) || day.is_holiday) return day
        const items = [...(day.items || [])]
        items.push({
          id: null,
          daily_menu_id: day.id,
          meal_id: "",
          display_order: items.length + 1,
          available: true,
          meals: null,
        })
        return {
          ...day,
          items,
        }
      })
    )
  }
  const removeMenuDaySlot = (dayId, index) => {
    setMenuDays((prev) =>
      prev.map((day) => {
        if (Number(day.id) !== Number(dayId)) return day
        const items = [...(day.items || [])]
        if (index < 0 || index >= items.length) return day
        items.splice(index, 1)
        return {
          ...day,
          items: items.map((item, i) => ({
            ...item,
            display_order: i + 1,
          })),
        }
      })
    )
  }
  const saveMenuDay = async (day) => {
    if (!day?.id) return false
    setSavingMenuDay(day.id)
    try {
      if (!day.is_holiday) {
        const rows = (day.items || [])
          .filter((item) => item?.meal_id)
          .map((item, index) => ({
            daily_menu_id: day.id,
            meal_id: item.meal_id,
            display_order: index + 1,
            available: true,
          }))
        if (rows.length === 0) {
          const proceed = window.confirm(
            "هذا اليوم لا يحتوي على أي وجبة. هل تريد حفظه بدون وجبات؟"
          )
          if (!proceed) return false
        }
        const { error: deleteError } = await supabase
          .from("daily_menu_items")
          .delete()
          .eq("daily_menu_id", day.id)
        if (deleteError) throw deleteError
        const { error: insertError } = await supabase
          .from("daily_menu_items")
          .insert(rows)
        if (insertError) throw insertError
      } else {
        const { error: deleteError } = await supabase
          .from("daily_menu_items")
          .delete()
          .eq("daily_menu_id", day.id)
        if (deleteError) throw deleteError
      }
      const { error: dayError } = await supabase
        .from("daily_menu")
        .update({ is_holiday: Boolean(day.is_holiday) })
        .eq("id", day.id)
      if (dayError) throw dayError
      const { data: refreshedItems, error: itemsError } = await supabase
        .from("daily_menu_items")
        .select("id, daily_menu_id, meal_id, display_order, available, meals(id, name, image_url, price)")
        .eq("daily_menu_id", day.id)
        .order("display_order", { ascending: true })
      if (itemsError) throw itemsError
      setMenuDays((prev) => prev.map((d) =>
        d.id === day.id
          ? { ...d, is_holiday: Boolean(day.is_holiday), items: refreshedItems || [] }
          : d
      ))
      return true
    } catch (error) {
      console.error("SAVE MENU DAY ERROR:", error)
      alert("تعذر حفظ هذا اليوم:\n" + error.message)
      return false
    } finally {
      setSavingMenuDay(null)
    }
  }
  const toggleMenuHoliday = (dayId) => {
    setMenuDays((prev) => prev.map((day) => day.id === dayId ? { ...day, is_holiday: !day.is_holiday, items: !day.is_holiday ? [] : day.items } : day))
  }
  const publishMenuDay = async (day) => {
    try {
      const saved = await saveMenuDay(day)
      if (!saved) return
      const { data: publishedRow, error } = await supabase
        .from("daily_menu")
        .update({ is_published: true })
        .eq("id", day.id)
        .select("id, is_published")
        .single()
      if (error) throw error
      if (!publishedRow?.is_published) {
        throw new Error("لم يتم تأكيد حالة النشر من قاعدة البيانات.")
      }
      setMenuDays((prev) => prev.map((d) =>
        d.id === day.id ? { ...d, is_published: true } : d
      ))
      alert("تم نشر قائمة هذا اليوم بنجاح.")
    } catch (error) {
      console.error("PUBLISH MENU DAY ERROR:", error)
      alert("تعذر نشر اليوم:\n" + error.message)
    }
  }
  const unpublishMenuDay = async (day) => {
    try {
      const { error } = await supabase.from("daily_menu").update({ is_published: false }).eq("id", day.id)
      if (error) throw error
      setMenuDays((prev) => prev.map((d) => d.id === day.id ? { ...d, is_published: false } : d))
    } catch (error) {
      console.error("UNPUBLISH MENU DAY ERROR:", error)
      alert("تعذر إلغاء نشر اليوم:\n" + error.message)
    }
  }
  /* ======================================================
     LOAD PUBLISHED MENU FOR WEBSITE
     الموقع والمشترك يقرآن فقط من جدول الأيام المنشورة
  ====================================================== */
  const loadPublishedMenu = async () => {
    setLoadingPublishedMenu(true)
    try {
      const settings = siteSettings || DEFAULT_SITE_SETTINGS
      const now = getAmmanNow()
      const windowOpen = isWithinTimeWindow(
        settings.menu_publish_time,
        settings.menu_stop_time,
        now.minutes
      )
      const today = new Date(`${now.date}T00:00:00`)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const subscriberDateText = getNextSubscriberDate(today)
      const formatDate = (date) => formatDateLocal(date)
      const loadOneDay = async (dateText) => {
        const { data: dayRows, error: dayError } = await supabase
          .from("daily_menu")
          .select("id, month_id, day_number, menu_date, is_holiday, is_published, notes")
          .eq("menu_date", dateText)
          .eq("is_published", true)
          .order("id", { ascending: false })
          .limit(1)
        if (dayError) throw dayError
        const day = dayRows?.[0] || null
        if (!day) return null
        const { data: items, error: itemsError } = await supabase
          .from("daily_menu_items")
          .select("id, display_order, available, meal_id, meals(id, name, description, image_url, price, active, is_available)")
          .eq("daily_menu_id", day.id)
          .eq("available", true)
          .order("display_order", { ascending: true })
        if (itemsError) throw itemsError
        return {
          ...day,
          items: (items || []).filter(
            (item) => item.meals && item.meals.active && item.meals.is_available
          ),
        }
      }
      const [todayMenu, tomorrowMenu, subscriberMenu] = await Promise.all([
        loadOneDay(now.date),
        loadOneDay(formatDate(tomorrow)),
        loadOneDay(subscriberDateText),
      ])
      // اليوم يبقى ظاهراً إذا كان منشوراً، أما قائمة الغد واختيار المشترك
      // فتتبع نافذة النشر/الإيقاف التي يحددها المدير من الإدارة.
      setPublishedDailyMenu(todayMenu)
      setPublishedTomorrowMenu(windowOpen ? tomorrowMenu : null)
      setPublishedSubscriberMenu(windowOpen ? subscriberMenu : null)
    } catch (error) {
      console.error("PUBLISHED MENU ERROR:", error)
      setPublishedDailyMenu(null)
      setPublishedTomorrowMenu(null)
      setPublishedSubscriberMenu(null)
    } finally {
      setLoadingPublishedMenu(false)
    }
  }
  /* ======================================================
     LOAD ADMIN DAILY MENU
  ====================================================== */
  const loadAdminDailyMenu = async () => {
    setLoadingAdminDailyMenu(true)
    try {
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
      const loadOneDay = async (date) => {
        const { data: dayRows, error: dayError } = await supabase.from("daily_menu").select("id, month_id, day_number, menu_date, is_holiday, is_published, notes").eq("menu_date", date).eq("is_published", true).order("id", { ascending: false }).limit(1)
        if (dayError) throw dayError
        const day = dayRows?.[0] || null
        if (!day) return null
        const { data: items, error: itemsError } = await supabase.from("daily_menu_items").select("id, display_order, available, meal_id, meals(id, name, image_url, price)").eq("daily_menu_id", day.id).order("display_order", { ascending: true })
        if (itemsError) throw itemsError
        return { ...day, items: (items || []).filter((item) => item.meals) }
      }
      const [todayMenu, tomorrowMenu] = await Promise.all([loadOneDay(formatDate(today)), loadOneDay(formatDate(tomorrow))])
      setAdminDailyMenu({ today: todayMenu, tomorrow: tomorrowMenu })
    } catch (error) {
      console.error("ADMIN DAILY MENU ERROR:", error)
      alert("حدث خطأ أثناء تحميل قائمة اليوم والغد:\n" + error.message)
    } finally {
      setLoadingAdminDailyMenu(false)
    }
  }
  /* ======================================================
     LOAD DASHBOARD
  ====================================================== */
const loadDashboard = async () => {
  setLoadingDashboard(true)
  try {
    const today = getToday()
    /* =========================
       SUBSCRIPTIONS
    ========================= */
    const {
      data: subscriptionsData,
      error: subscriptionsError,
    } = await supabase
      .from("subscriptions")
      .select("*")
      .order("created_at", {
        ascending: false,
      })
    if (subscriptionsError) {
      console.error(
        "SUBSCRIPTIONS LOAD ERROR:",
        subscriptionsError
      )
    }
    const loadedSubscriptions =
      subscriptionsData || []
    setSubscriptions(
      loadedSubscriptions
    )
    /* =========================
       ACTIVE SUBSCRIBERS
    ========================= */
    const activeSubscriptions =
      loadedSubscriptions.filter(
        (subscription) =>
          subscription.status ===
            "active" &&
          subscription.start_date &&
          subscription.end_date &&
          today >=
            subscription.start_date &&
          today <=
            subscription.end_date
      )
    /* =========================
       SUBSCRIBER MEALS
       الوجبات المختارة فعلياً
    ========================= */
    const {
      data: subscriberMealsData,
      error: subscriberMealsError,
    } = await supabase
      .from("subscription_daily_meals")
      .select("*")
      .eq("meal_date", today)
    if (subscriberMealsError) {
      console.error(
        "SUBSCRIBER DAILY MEALS ERROR:",
        subscriberMealsError
      )
    }
    const activeSubscriptionIds =
      new Set(
        activeSubscriptions.map(
          (subscription) =>
            subscription.id
        )
      )
    const loadedSubscriberMeals =
      (subscriberMealsData || []).filter(
        (item) =>
          activeSubscriptionIds.has(
            item.subscription_id
          )
      )
setSubscriberDailyMeals(
  loadedSubscriberMeals
)
    const subscriberMeals =
      loadedSubscriberMeals.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.quantity || 0
          ),
        0
      )
    /* =========================
       DAILY ORDERS
    ========================= */
    const {
      data: ordersData,
      error: ordersError,
    } = await supabase
      .from("daily_orders")
      .select("*")
      .eq(
        "order_date",
        today
      )
      .order("created_at", {
        ascending: false,
      })
    if (ordersError) {
      console.error(
        "ORDERS LOAD ERROR:",
        ordersError
      )
    }
    const loadedOrders =
      ordersData || []
    setDailyOrders(
      loadedOrders
    )
    const dailyMeals =
      loadedOrders
        .filter(
          (order) =>
            order.status !==
            "cancelled"
        )
        .reduce(
          (
            total,
            order
          ) =>
            total +
            Number(
              order.quantity || 0
            ),
          0
        )
    /* =========================
       TOTAL
    ========================= */
    setDashboard({
      subscriberMeals,
      dailyMeals,
      totalMeals:
        subscriberMeals +
        dailyMeals,
    })
  } catch (error) {
    console.error(
      "DASHBOARD ERROR:",
      error
    )
  } finally {
    setLoadingDashboard(false)
  }
}
  /* ======================================================
     SITE SETTINGS
  ====================================================== */
  const normalizePhone = (value) => String(value || "").trim()
  const normalizeWhatsapp = (value) => {
    let digits = String(value || "").replace(/\D/g, "")
    if (digits.startsWith("00")) digits = digits.slice(2)
    if (digits.startsWith("07") && digits.length === 10) digits = `962${digits.slice(1)}`
    if (digits.startsWith("7") && digits.length === 9) digits = `962${digits}`
    return digits
  }
  const normalizeSocialUrl = (value, platform) => {
    let url = String(value || "").trim()
    if (!url) return ""
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    try {
      const parsed = new URL(url)
      if (platform === "instagram" && !parsed.hostname.toLowerCase().includes("instagram.com")) return ""
      if (platform === "facebook" && !parsed.hostname.toLowerCase().includes("facebook.com")) return ""
      return parsed.toString()
    } catch {
      return ""
    }
  }
  const loadSiteSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle()
      if (error) throw error
      if (data) {
        setSiteSettings({
          ...DEFAULT_SITE_SETTINGS,
          ...data,
          contact_phone: data.contact_phone || "",
          whatsapp_phone: data.whatsapp_phone || "",
          instagram_url: data.instagram_url || "",
          facebook_url: data.facebook_url || "",
          footer_meal_images: Array.isArray(data.footer_meal_images) ? data.footer_meal_images : [],
        })
      }
    } catch (error) {
      console.error("SITE SETTINGS LOAD ERROR:", error)
    } finally {
      setSiteSettingsLoaded(true)
    }
  }
  const onSaveSiteSettings = async (form) => {
    setSiteSettingsSaving(true)
    try {
      const footerImages = Array.from({ length: 6 }, (_, index) => String(form.footer_meal_images?.[index] || "").trim())
      const payload = {
        id: 1,
        slogan: String(form.slogan || DEFAULT_SITE_SETTINGS.slogan).trim(),
        contact_phone: normalizePhone(form.contact_phone),
        whatsapp_phone: normalizeWhatsapp(form.whatsapp_phone),
        instagram_url: normalizeSocialUrl(form.instagram_url, "instagram"),
        facebook_url: normalizeSocialUrl(form.facebook_url, "facebook"),
        hero_image_url: String(form.hero_image_url || "").trim(),
        circle_image_url: String(form.circle_image_url || "").trim(),
        story_image_url: String(form.story_image_url || "").trim(),
        cta_image_url: String(form.cta_image_url || "").trim(),
        footer_meal_images: footerImages,
        menu_publish_time: form.menu_publish_time || DEFAULT_SITE_SETTINGS.menu_publish_time,
        menu_stop_time: form.menu_stop_time || DEFAULT_SITE_SETTINGS.menu_stop_time,
        daily_delivery_fee: Math.max(0, Number(form.daily_delivery_fee ?? DEFAULT_SITE_SETTINGS.daily_delivery_fee) || 0),
        timezone: "Asia/Amman",
      }
      const { data, error } = await supabase
        .from("site_settings")
        .upsert(payload, { onConflict: "id", ignoreDuplicates: false })
        .select("*")
        .single()
      if (error?.code === "PGRST116") {
        throw new Error("تعذر قراءة إعدادات الموقع بعد الحفظ. تأكد من صلاحيات جدول site_settings.")
      }
      if (error) throw error
      setSiteSettings({ ...DEFAULT_SITE_SETTINGS, ...data, footer_meal_images: Array.isArray(data.footer_meal_images) ? data.footer_meal_images : [] })
      alert("تم حفظ بيانات الاتصال وروابط التواصل وإعدادات الموقع بنجاح ✅")
    } catch (error) {
      console.error("SITE SETTINGS SAVE ERROR:", error)
      alert(`تعذر حفظ إعدادات الموقع:\n${error.message}`)
    } finally {
      setSiteSettingsSaving(false)
    }
  }

  /* ======================================================
     EFFECTS
  ====================================================== */
  useEffect(() => {
    loadSiteSettings()
  }, [])
  // تحديث قائمة الوجبات المنشورة تلقائياً حتى تنعكس تعديلات الإدارة على الموقع
  // ورابط المشترك بدون الحاجة لإعادة نشر نسخة من التطبيق.
  useEffect(() => {
    const publicPages = ["home", "daily", "subscriber", "subscriptions"]
    if (!publicPages.includes(page)) return undefined
    const interval = window.setInterval(() => {
      loadPublishedMenu()
    }, 15000)
    return () => window.clearInterval(interval)
  }, [page])
  useEffect(() => {
    if (page === "admin") {
      loadDashboard()
      if (adminPage === "meals") {
        setMenuView("planner")
        ;(async () => {
          await loadMeals()
          await loadMenuPlan()
        })()
      } else {
        loadMeals()
      }
      if (adminPage === "daily-menu") {
        loadAdminDailyMenu()
      }
    }
    if (page === "home" || page === "daily" || page === "subscriber" || page === "subscriptions") {
      loadPublishedMenu()
      loadMeals()
    }
  }, [page, adminPage, siteSettingsLoaded, siteSettings.menu_publish_time, siteSettings.menu_stop_time])
  useEffect(() => {
    let mounted = true
    const loadUserProfile = async () => {
      setAuthLoading(true)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!mounted) return
        setUser(user || null)
        if (user) {
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single()
          if (!mounted) return
          if (error) {
            console.error(
              "PROFILE LOAD ERROR:",
              error
            )
            setProfile(null)
          } else {
            setProfile(data)
          }
        } else {
          setProfile(null)
        }
      } catch (error) {
        console.error(
          "AUTH ERROR:",
          error
        )
        if (mounted) {
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (mounted) {
          setAuthLoading(false)
        }
      }
    }
    loadUserProfile()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser =
          session?.user || null
        if (!mounted) return
        setUser(currentUser)
        if (!currentUser) {
          setProfile(null)
          return
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", currentUser.id)
          .single()
        if (!mounted) return
        if (error) {
          console.error(
            "PROFILE LOAD ERROR:",
            error
          )
          setProfile(null)
        } else {
          setProfile(data)
        }
      }
    )
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])
  /* ======================================================
     SAVE SUBSCRIPTION
  ====================================================== */
const generateTrackingToken = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let token = "MN-"
  for (let i = 0; i < 8; i++) {
    token += chars[Math.floor(Math.random() * chars.length)]
  }
  return token
}
  const buildCustomerAddress = () => {
    const base = customerAddress.trim()
    const map = customerMapLink.trim()
    const note = customerNote.trim()
    const parts = [base]
    if (map) parts.push(`رابط موقع Google Maps: ${map}`)
    if (note) parts.push(`ملاحظات: ${note}`)
    return parts.filter(Boolean).join("\n")
  }
  const addSubscriptionToCart = ({ plan }) => {
    if (!plan) return
    setCart((currentCart) => [
      ...currentCart.filter((item) => item.kind !== "subscription"),
      {
        kind: "subscription",
        cart_id: `subscription-${plan.id}`,
        plan_id: plan.id,
        plan_days: plan.days,
        meals_per_day: plan.meals,
        plan_price: Number(plan.price),
        price: Number(plan.price),
        quantity: 1,
        total: Number(plan.price),
        meal_name: `اشتراك ${plan.days} يوم — ${plan.meals} وجبة يومياً`,
        image: mealFallbackImage(0),
      },
    ])
    setSelectedPlan(null)
    setCartOpen(true)
  }
  const saveSubscription = async () => {
    // الاشتراك أصبح يمر أولاً عبر السلة ثم يتم تأكيده منها.
    setCartOpen(true)
  }
  const openDailyOrder = (meal = null) => {
    const selected = meal || publicTodayMeals[0]
    if (!selected) {
      alert("لا توجد وجبات متاحة حالياً.")
      return
    }
    addToCart(selected, 1)
  }
  const saveDailyOrder = async () => {
    // الطلب اليومي أصبح يمر عبر السلة ثم يتم تأكيده منها.
    if (selectedDailyMeal) addToCart(selectedDailyMeal, Number(dailyQuantity) || 1)
    setDailyOrderOpen(false)
  }
  const saveSubscriptionRecord = async (item, customer) => {
    const startDate = new Date()
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + Number(item.plan_days) - 1)
    const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    const start = formatDate(startDate)
    const end = formatDate(endDate)
    const totalMeals = Number(item.plan_days) * Number(item.meals_per_day)
    const address = [customer.address.trim(), customer.mapLink.trim() ? `رابط موقع Google Maps: ${customer.mapLink.trim()}` : "", customer.note?.trim() ? `ملاحظات: ${customer.note.trim()}` : ""].filter(Boolean).join("\n")
    const payload = {
      customer_id: null,
      plan_id: item.plan_id,
      customer_name: customer.name.trim(),
      phone: customer.phone.trim(),
      address,
      plan_days: Number(item.plan_days),
      meals_per_day: Number(item.meals_per_day),
      price: Number(item.plan_price),
      start_date: start,
      end_date: end,
      total_meals: totalMeals,
      used_meals: 0,
      remaining_meals: totalMeals,
      tracking_token: generateTrackingToken(),
      status: "active",
      latitude: customer.location.latitude,
      longitude: customer.location.longitude,
    }
    const { data, error } = await supabase.from("subscriptions").insert(payload).select().single()
    if (error) throw error
    return data
  }
  const confirmCheckout = async () => {
    if (!cart.length) {
      alert("السلة فارغة.")
      return
    }
    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
      alert("يرجى كتابة الاسم ورقم الهاتف وعنوان السكن بالتفصيل.")
      return
    }
    setCheckoutSaving(true)
    try {
      const customer = {
        name: customerName,
        phone: customerPhone,
        address: customerAddress,
        mapLink: customerMapLink,
        note: customerNote,
        location: customerLocation,
      }
      const subscriptionItems = cart.filter((item) => item.kind === "subscription")
      const dailyItems = cart.filter((item) => item.kind !== "subscription")
      const createdSubscriptions = []
      for (const item of subscriptionItems) {
        const created = await saveSubscriptionRecord(item, customer)
        createdSubscriptions.push(created)
      }
      if (dailyItems.length) {
        const rows = dailyItems.map((item, index) => ({
          customer_name: customer.name.trim(),
          phone: customer.phone.trim(),
          address: [customer.address.trim(), customer.mapLink.trim() ? `رابط موقع Google Maps: ${customer.mapLink.trim()}` : "", customerNote.trim() ? `ملاحظات: ${customerNote.trim()}` : ""].filter(Boolean).join("\n"),
          meal_name: item.meal_name,
          quantity: Number(item.quantity || 1),
          order_date: item.order_date || getAmmanNow().date,
          delivery_price: index === 0 ? Number(siteSettings.daily_delivery_fee ?? 1) : 0,
          total_price: Number(item.total || 0) + (index === 0 ? Number(siteSettings.daily_delivery_fee ?? 1) : 0),
          status: "pending",
          latitude: customer.location.latitude,
          longitude: customer.location.longitude,
        }))
        const { error } = await supabase.from("daily_orders").insert(rows)
        if (error) throw error
      }
      if (createdSubscriptions.length) {
        const created = createdSubscriptions[0]
        setSubscriberData({
          ...created,
          trackingUrl: `${window.location.origin}/?tracking=${created.tracking_token}`,
        })
        setPage("subscriber")
      } else {
        setPage("home")
        alert("تم تأكيد طلبك بنجاح ❤️")
      }
      setCart([])
      setCartOpen(false)
      setCheckoutOpen(false)
      setCustomerName("")
      setCustomerPhone("")
      setCustomerAddress("")
      setCustomerMapLink("")
      setCustomerNote("")
      setCustomerLocation({ latitude: null, longitude: null })
      await loadDashboard()
    } catch (error) {
      console.error("CHECKOUT ERROR:", error)
      alert("تعذر تأكيد الطلب:\n" + (error?.message || "خطأ غير معروف"))
    } finally {
      setCheckoutSaving(false)
    }
  }
  /* ======================================================
     UPDATE DAILY ORDER
  ====================================================== */
  const updateDailyOrderStatus =
    async (
      orderId,
      newStatus
    ) => {
      setUpdatingOrder(orderId)
      try {
        const allowedStatuses = [
          "pending",
          "confirmed",
          "preparing",
          "delivered",
          "cancelled",
        ]
        if (
          !allowedStatuses.includes(
            newStatus
          )
        ) {
          alert(
            "حالة الطلب غير صحيحة"
          )
          return
        }
        const {
          error,
        } = await supabase
          .from("daily_orders")
          .update({
            status:
              newStatus,
          })
          .eq(
            "id",
            orderId
          )
        if (error) {
          alert(
            "حدث خطأ أثناء تحديث الطلب:\n" +
              error.message
          )
          return
        }
        await loadDashboard()
      } catch (error) {
        console.error(error)
        alert(
          "حدث خطأ في الاتصال بقاعدة البيانات"
        )
      } finally {
        setUpdatingOrder(null)
      }
    }
  /* ======================================================
     EDIT SUBSCRIPTION
  ====================================================== */
  const openEditSubscription =
    (subscription) => {
      setEditingSubscription(
        subscription
      )
    }
  const updateSubscription =
    async (form) => {
      if (
        !form.customer_name.trim() ||
        !form.phone.trim() ||
        !form.address.trim()
      ) {
        alert(
          "يرجى تعبئة جميع البيانات"
        )
        return
      }
      setUpdatingSubscription(
        editingSubscription.id
      )
      try {
        const totalMeals =
          Number(
            form.plan_days
          ) *
          Number(
            form.meals_per_day
          )
        const usedMeals =
          Number(
            editingSubscription.used_meals ||
              0
          )
        const remainingMeals =
          Math.max(
            0,
            totalMeals -
              usedMeals
          )
        const {
          error,
        } = await supabase
          .from("subscriptions")
          .update({
            customer_name:
              form.customer_name.trim(),
            phone:
              form.phone.trim(),
            address:
              form.address.trim(),
            plan_days:
              Number(
                form.plan_days
              ),
            meals_per_day:
              Number(
                form.meals_per_day
              ),
            price:
              Number(
                form.price
              ),
            total_meals:
              totalMeals,
            remaining_meals:
              remainingMeals,
            status:
              form.status,
          })
          .eq(
            "id",
            editingSubscription.id
          )
        if (error) {
          alert(
            "حدث خطأ أثناء تعديل المشترك:\n" +
              error.message
          )
          return
        }
        alert(
          "تم تعديل بيانات المشترك بنجاح ✅"
        )
        setEditingSubscription(
          null
        )
        await loadDashboard()
      } catch (error) {
        console.error(error)
        alert(
          "حدث خطأ في الاتصال بقاعدة البيانات"
        )
      } finally {
        setUpdatingSubscription(
          null
        )
      }
    }
  /* ======================================================
     TOGGLE SUBSCRIPTION
  ====================================================== */
  const toggleSubscription =
    async (
      subscription
    ) => {
      const newStatus =
        subscription.status ===
        "active"
          ? "paused"
          : "active"
      setUpdatingSubscription(
        subscription.id
      )
      try {
        const {
          error,
        } = await supabase
          .from("subscriptions")
          .update({
            status:
              newStatus,
          })
          .eq(
            "id",
            subscription.id
          )
        if (error) {
          alert(
            "حدث خطأ:\n" +
              error.message
          )
          return
        }
        await loadDashboard()
      } catch (error) {
        console.error(error)
        alert(
          "حدث خطأ في الاتصال بقاعدة البيانات"
        )
      } finally {
        setUpdatingSubscription(
          null
        )
      }
    }
  /* ======================================================
     ACTIVE SUBSCRIPTIONS
  ====================================================== */
  const activeSubscriptions =
    subscriptions.filter(
      (item) =>
        item.status ===
        "active"
    )
  const todayPublishedItems = (publishedDailyMenu?.items || [])
    .map((item) => item.meals)
    .filter(Boolean)
  const tomorrowPublishedItems = (publishedTomorrowMenu?.items || [])
    .map((item) => item.meals)
    .filter(Boolean)
  const subscriberPublishedItems = (publishedSubscriberMenu?.items || [])
    .map((item) => item.meals)
    .filter(Boolean)
  // في يوم العطلة أو عندما لا تكون قائمة اليوم منشورة،
  // نعرض أقرب قائمة منشورة قادمة حتى لا تبقى الصفحة فارغة.
  const buildPublishedMeals = (primary = [], secondary = []) => {
    const result = []
    const seen = new Set()
    for (const meal of [...primary, ...secondary]) {
      if (!meal || seen.has(String(meal.id))) continue
      seen.add(String(meal.id))
      result.push(meal)
    }
    return result
  }
  const publicTodayMeals = buildPublishedMeals(todayPublishedItems, [])
  const publicTomorrowMeals = buildPublishedMeals(tomorrowPublishedItems, [])
  const publicSubscriberMeals = buildPublishedMeals(subscriberPublishedItems, [])
  const publicTodayMenuDate =
    todayPublishedItems.length > 0
      ? publishedDailyMenu?.menu_date
      : getToday()
  const publicTodayMenuIsFallback = todayPublishedItems.length === 0
const addToCart = (meal, quantity = 1, orderDate = getAmmanNow().date) => {
  if (!meal) return
  const price = Number(meal.price || DAILY_PRICE)
  const safeQuantity = Math.max(1, Number(quantity) || 1)
  const cartId = `daily-${meal.id}-${orderDate}`
  setCart((currentCart) => {
    const existing = currentCart.find((item) => String(item.cart_id) === String(cartId))
    if (existing) {
      const nextQuantity = Number(existing.quantity || 0) + safeQuantity
      return currentCart.map((item) => String(item.cart_id) === String(cartId)
        ? { ...item, quantity: nextQuantity, total: nextQuantity * Number(item.price || price) }
        : item)
    }
    return [...currentCart, {
      kind: "daily",
      cart_id: cartId,
      meal_id: meal.id,
      meal_name: meal.name,
      order_date: orderDate,
      price,
      quantity: safeQuantity,
      delivery_price: 0,
      total: price * safeQuantity,
      image: meal.image_url || meal.image || mealFallbackImage(0),
    }]
  })
  setCartOpen(true)
}
const updateCartQuantity = (cartId, quantity) => {
  const newQuantity = Number(quantity)
  if (newQuantity <= 0) {
    removeFromCart(cartId)
    return
  }
  setCart((currentCart) => currentCart.map((item) => {
    const id = item.cart_id || item.meal_id || item.plan_id
    if (String(id) !== String(cartId)) return item
    if (item.kind === "subscription") return item
    return { ...item, quantity: newQuantity, total: newQuantity * Number(item.price || 0) }
  }))
}
const removeFromCart = (cartId) => {
  setCart((currentCart) => currentCart.filter((item) => String(item.cart_id || item.meal_id || item.plan_id) !== String(cartId)))
}
const clearCart = () => {
  setCart([])
}
  /* ======================================================
     RETURN
  ====================================================== */
  return (
    <div
      className="app"
      dir="rtl"
    >
      <Header
  page={page}
  setPage={setPage}
  profile={profile}
  cartItemsCount={cartItemsCount}
onOpenCart={() => setCartOpen(true)}
siteSettings={siteSettings}
/>
{page === "subscriber" && (
  <SubscriberPage
    subscription={subscriberData}
    availableMeals={publicTodayMeals}
    tomorrowAvailableMeals={publicSubscriberMeals}
    onClose={() => setPage("home")}
  />
)}
      {/* ==================================================
          HOME
      ================================================== */}
      {page === "home" && (
        <HomePage
          plans={plans}
          meals={publicTodayMeals}
          onSubscriptions={() =>
            setPage(
              "subscriptions"
            )
          }
          onDaily={() =>
            setPage("daily")
          }
          onAddToCart={addToCart}
          siteSettings={siteSettings}
        />
      )}
      {/* ==================================================
          SUBSCRIPTIONS
      ================================================== */}
      {page ===
        "subscriptions" && (
        <SubscriptionsPage
          plans={plans}
          onSelect={setSelectedPlan}
        />
      )}
{/* ==================================================
    SUBSCRIPTION POPUP
================================================== */}
{selectedPlan && (
  <SubscriptionPopup
    selectedPlan={selectedPlan}
    onAddToCart={addSubscriptionToCart}
    onClose={() => setSelectedPlan(null)}
  />
)}
      {/* ==================================================
          DAILY
      ================================================== */}
      {page === "daily" && (
        <DailyPage
        
          meals={publicTodayMeals}
          tomorrowMeals={publicTomorrowMeals}
          menuDate={publicTodayMenuDate}
          tomorrowMenuDate={publishedTomorrowMenu?.menu_date || null}
          menuIsFallback={publicTodayMenuIsFallback}
          ordersClosed={false}
          onOrder={openDailyOrder}
          onAddToCart={addToCart}
          deliveryFee={Number(siteSettings.daily_delivery_fee ?? 1)}
        />
      )}
      {/* ==================================================
          ADMIN
      ================================================== */}
{page === "admin" && !user && (
  <AdminLogin
    onLogin={loginAdmin}
  />
)}
{page === "admin" && user && profile?.role === "admin" && (
  <AdminPage
    dashboard={dashboard}
    subscriptions={subscriptions}
    activeSubscriptions={activeSubscriptions}
    dailyOrders={dailyOrders}
    subscriberDailyMeals={
  subscriberDailyMeals
}
    meals={meals}
    loadingMeals={loadingMeals}
    onRefreshMeals={loadMeals}
    onAddMeal={openAddMeal}
    onEditMeal={openEditMeal}
    onDeleteMeal={deleteMeal}
    onToggleMeal={toggleMeal}
    onToggleAvailability={toggleMealAvailability}
    deletingMeal={deletingMeal}
    loading={loadingDashboard}
    onRefresh={loadDashboard}
    adminPage={adminPage}
    setAdminPage={setAdminPage}
    onUpdateOrderStatus={updateDailyOrderStatus}
    updatingOrder={updatingOrder}
    onEditSubscription={openEditSubscription}
    onToggleSubscription={toggleSubscription}
    updatingSubscription={updatingSubscription}
    adminDailyMenu={adminDailyMenu}
    loadingAdminDailyMenu={loadingAdminDailyMenu}
    onRefreshAdminDailyMenu={loadAdminDailyMenu}
    menuMonth={menuMonth}
    menuDays={menuDays}
    loadingMenuPlan={loadingMenuPlan}
    menuView={menuView}
    setMenuView={setMenuView}
    onLoadMenuPlan={loadMenuPlan}
    onSelectMeal={updateMenuDayLocal}
    onAddMealSlot={addMenuDaySlot}
    onRemoveMealSlot={removeMenuDaySlot}
    onToggleHoliday={toggleMenuHoliday}
    onSaveMenuDay={saveMenuDay}
    onPublishMenuDay={publishMenuDay}
    onUnpublishMenuDay={unpublishMenuDay}
    savingMenuDay={savingMenuDay}
    siteSettings={siteSettings}
    siteSettingsSaving={siteSettingsSaving}
    onSaveSiteSettings={onSaveSiteSettings}
  />
  
)}
{/* KITCHEN */}
{page === "kitchen" &&
  user &&
  profile?.role === "kitchen" && (
    <KitchenScreen
  dashboard={dashboard}
  activeSubscriptions={
    activeSubscriptions
  }
  dailyOrders={
    dailyOrders
  }
  subscriberDailyMeals={
    subscriberDailyMeals
  }
/>
  )}
{page === "delivery" && user && profile?.role === "driver" && (
  <DeliveryScreen
    dailyOrders={dailyOrders}
    subscriberDailyMeals={subscriberDailyMeals}
    activeSubscriptions={activeSubscriptions}
    onUpdate={updateDailyOrderStatus}
    updating={updatingOrder}
    onRefresh={loadDashboard}
    profile={profile}
  />
)}
            {/* ==================================================
          MEAL FORM
      ================================================== */}
      {mealFormOpen && (
        <MealFormPopup
          meal={
            editingMeal
          }
          saving={
            mealSaving
          }
          onSave={
            saveMeal
          }
          onClose={() => {
            setMealFormOpen(
              false
            )
            setEditingMeal(
              null
            )
          }}
        />
      )}
      {/* ==================================================
          EDIT SUBSCRIPTION
      ================================================== */}
      {editingSubscription && (
        <EditSubscriptionPopup
          subscription={
            editingSubscription
          }
          saving={
            updatingSubscription ===
            editingSubscription.id
          }
          onSave={
            updateSubscription
          }
          onClose={() =>
            setEditingSubscription(
              null
            )
          }
        />
      )}
      {cartOpen && (
  <CartPopup
    cart={cart}
    subtotal={cartSubtotal}
    onClose={() => setCartOpen(false)}
    onUpdateQuantity={updateCartQuantity}
    onRemove={removeFromCart}
    onClear={clearCart}
    onCheckout={() => {
  setCartOpen(false)
  setCheckoutOpen(true)
  
}}
  />
)}
{checkoutOpen && (
  <CheckoutPopup
    cart={cart}
    subtotal={cartSubtotal}
    customerName={customerName}
    setCustomerName={setCustomerName}
    customerPhone={customerPhone}
    setCustomerPhone={setCustomerPhone}
    customerAddress={customerAddress}
    setCustomerAddress={setCustomerAddress}
    customerMapLink={customerMapLink}
    setCustomerMapLink={setCustomerMapLink}
    customerNote={customerNote}
    setCustomerNote={setCustomerNote}
    onUseLocation={useCustomerLocation}
    customerLocation={customerLocation}
    checkoutSaving={checkoutSaving}
    onClose={() => { setCheckoutOpen(false); setCustomerLocation({ latitude: null, longitude: null }) }}
    onConfirm={confirmCheckout}
  />
)}
      <button className="feedback-float" type="button" onClick={() => setFeedbackOpen(true)}>💬 ملاحظاتك تهمنا</button>
      {feedbackOpen && <FeedbackPopup onClose={() => setFeedbackOpen(false)} />}
      {/* ==================================================
          FOOTER
      ================================================== */}
      <footer className="brand-footer">
        <div className="brand-footer-top">
          <div className="brand-footer-identity">
            <span className="brand-footer-handle">@chefnoorcuisine</span>
            <h2>مطبخ شيف نور</h2>
            <p>{siteSettings.slogan || DEFAULT_SITE_SETTINGS.slogan}</p>
          </div>
          <div className="brand-footer-social">
            {siteSettings.instagram_url && <a className="contact-link instagram-link" href={siteSettings.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram">📸 Instagram</a>}
            {siteSettings.facebook_url && <a className="contact-link facebook-link" href={siteSettings.facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook">f Facebook</a>}
            {siteSettings.whatsapp_phone && <a className="contact-link whatsapp-link" href={`https://wa.me/${normalizeWhatsapp(siteSettings.whatsapp_phone)}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">💬 WhatsApp</a>}
            {siteSettings.contact_phone && <a className="contact-link phone-link" href={`tel:${normalizePhone(siteSettings.contact_phone)}`} aria-label="اتصال">📞 {siteSettings.contact_phone}</a>}
          </div>
        </div>
        <div className="brand-footer-grid">
          {Array.from({ length: 6 }).map((_, index) => {
            const src = siteSettings.footer_meal_images?.[index] || brandImages.meals?.[index] || FOOTER_MEAL_IMAGES[index] || mealFallbackImage(index)
            return (
              <img
                key={`footer-meal-${index}`}
                src={src}
                alt={`طبق من مطبخ شيف نور ${index + 1}`}
                onError={(event) => {
                  const fallback = mealFallbackImage(index)
                  if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback
                }}
              />
            )
          })}
        </div>
        <p className="brand-footer-copy">
          © 2026 Chef Noor Cuisine — جميع الحقوق محفوظة
        </p>
      </footer>
    </div>
  )
}
/* ======================================================
   HEADER
====================================================== */
function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      alert("يرجى إدخال البريد الإلكتروني وكلمة المرور")
      return
    }
    setLoading(true)
    try {
      await onLogin(
        email.trim(),
        password
      )
    } finally {
      setLoading(false)
    }
  }
  return (
    <section className="section">
      <div className="section-title">
        <small>دخول الموظفين</small>
        <h2>🔐 تسجيل الدخول للإدارة</h2>
        <p>
          أدخل بيانات حساب الإدارة للمتابعة.
        </p>
      </div>
      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: "450px",
          margin: "30px auto",
          display: "grid",
          gap: "15px",
        }}
      >
        <input
          type="email"
          placeholder="البريد الإلكتروني"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
          required
        />
        <input
          type="password"
          placeholder="كلمة المرور"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          required
        />
        <button
          type="submit"
          className="main-btn"
          disabled={loading}
        >
          {loading
            ? "جاري تسجيل الدخول..."
            : "🔐 دخول"}
        </button>
      </form>
    </section>
  )
}
function Header({
  page,
  setPage,
  profile,
  cartItemsCount,
  onOpenCart,
  siteSettings = DEFAULT_SITE_SETTINGS,
}) {
  return (
    <>
      <div className="top-slogan-bar">
        <span>{siteSettings.slogan || DEFAULT_SITE_SETTINGS.slogan}</span>
        {siteSettings.contact_phone && <a href={`tel:${normalizePhone(siteSettings.contact_phone)}`} aria-label="اتصال بمطبخ شيف نور">📞 {siteSettings.contact_phone}</a>}
        {siteSettings.whatsapp_phone && <a href={`https://wa.me/${normalizeWhatsapp(siteSettings.whatsapp_phone)}`} target="_blank" rel="noopener noreferrer" aria-label="التواصل مع مطبخ شيف نور عبر واتساب">💬 واتساب</a>}
        {siteSettings.instagram_url && <a href={siteSettings.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="صفحة مطبخ شيف نور على Instagram">📸 Instagram</a>}
        {siteSettings.facebook_url && <a href={siteSettings.facebook_url} target="_blank" rel="noopener noreferrer" aria-label="صفحة مطبخ شيف نور على Facebook">f Facebook</a>}
      </div>
      <header className="header">
      <div className="brand">
        <div className="brand-icon">
  <img
    src="/images/logo.png"
    alt="Chef Noor Cuisine"
  />
</div>
        <div>
          <h1>
            مطبخ شيف نور
          </h1>
          <p>
            CHEF NOOR CUISINE
          </p>
        </div>
      </div>
      <nav>
        <button
          className={
            page === "home"
              ? "nav-active"
              : ""
          }
          onClick={() =>
            setPage("home")
          }
        >
          الرئيسية
        </button>
        <button
          className={
            page === "subscriptions"
              ? "nav-active"
              : ""
          }
          onClick={() =>
            setPage("subscriptions")
          }
        >
          الاشتراكات
        </button>
        <button
          className={
            page === "daily"
              ? "nav-active"
              : ""
          }
          onClick={() =>
            setPage("daily")
          }
        >
          وجبات اليوم
        </button>
        <button
          className="admin-nav"
          onClick={() =>
            setPage("admin")
          }
        >
          ⚙️ الإدارة
        </button>
        {profile && (
  <button
    className="admin-nav"
    onClick={async () => {
      await supabase.auth.signOut()
      setPage("home")
    }}
  >
    🚪 خروج
  </button>
)}
<button
  className="cart-button"
  onClick={onOpenCart}
  aria-label="فتح السلة"
>
  🛒
  {cartItemsCount > 0 && (
    <span className="cart-count">
      {cartItemsCount}
    </span>
  )}
</button>
      </nav>
    </header>
    </>
  )
}
function useInView(threshold = 0.16) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])
  return [ref, visible]
}
function Reveal({ className = "", children, as: Tag = "div" }) {
  const [ref, visible] = useInView()
  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`.trim()}
    >
      {children}
    </Tag>
  )
}
function AnimatedCounter({ end, suffix = "", duration = 1400 }) {
  const [ref, visible] = useInView(0.4)
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!visible) return
    const start = performance.now()
    let frame
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(end * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [visible, end, duration])
  return (
    <strong ref={ref} className="stat-count">
      {value}
      {suffix}
    </strong>
  )
}
/* ======================================================
   HOME
====================================================== */
function HomePage({
  onSubscriptions,
  onDaily,
  onAddToCart,
  plans = [],
  meals = [],
  siteSettings = DEFAULT_SITE_SETTINGS,
}) {
  const visibleMeals = (meals || []).filter(Boolean)
  const featuredPlans = (plans || []).slice(0, 6)
  return (
    <div className="home-page">
      <section className="brand-hero">
        <img
          className="brand-hero-photo"
          src={siteSettings.hero_image_url || brandImages.hero}
          alt="تصوير طعام من مطبخ شيف نور"
        />
        <div className="brand-hero-overlay">
          <span className="home-badge">Chef Noor Cuisine</span>
          <h1>أكلك اليوم... علينا</h1>
          <p>
            وجبات منزلية طازجة تُحضَّر يومياً، بمكونات واضحة وطعم البيت —
            بتوصيل سلس واشتراك يناسب يومك.
          </p>
          <div className="home-actions">
            <button className="home-secondary" onClick={onDaily}>
              شاهد وجبات اليوم
            </button>
          </div>
          <div className="hero-float-badges hero-badges-inline">
            <span>طبخ يومي</span>
            <span>مكونات طازجة</span>
            <span>توصيل يومي</span>
          </div>
        </div>
        <button className="hero-float-cta" onClick={onSubscriptions}>
          ابدأ اشتراكك
        </button>
        <div className="hero-circle">
          <img src={siteSettings.circle_image_url || brandImages.circle} alt="طبق اليوم" />
        </div>
      </section>
      <Reveal as="section" className="home-section meals-overlap">
        <div className="home-heading">
          <small>من السفرة إلى العدسة</small>
          <h2>وجبات اليوم</h2>
          <p>بطاقات طعام غير متماثلة… مثل ستوري إنستغرام، لا شبكة مملّة.</p>
        </div>
        <div className="meals-masonry">
          {visibleMeals.length ? visibleMeals.map((meal, index) => (
            <article
              className={`meal-card meal-card-${index % 3 === 0 ? "lg" : index % 3 === 1 ? "md" : "sm"}`}
              key={meal.id || meal.name}
            >
              <div className="meal-photo">
                <img
                  src={meal.image_url || mealFallbackImage(index)}
                  alt={meal.name}
                />
              </div>
              <div className="meal-body">
                <h3>{meal.name}</h3>
                <p>{meal.description || "وجبة منزلية طازجة محضّرة بعناية."}</p>
                <div className="meal-bottom">
                  <span className="meal-price">{meal.price || DAILY_PRICE} د.أ</span>
                  <button className="home-secondary" onClick={() => onAddToCart?.(meal)}>أضف للسلة</button>
                </div>
              </div>
            </article>
          )) : (
            <div className="home-empty">سيتم عرض وجبات اليوم هنا بمجرد نشر قائمة اليوم.</div>
          )}
        </div>
      </Reveal>
      <Reveal as="section" className="home-section alt">
        <div className="home-heading">
          <small>اشترك وارتاح</small>
          <h2>باقات تبرز الأفضل</h2>
          <p>اختر عدد الأيام وعدد الوجبات التي تناسبك، والتوصيل مشمول ضمن الاشتراك.</p>
        </div>
        <div className="home-plans">
          {featuredPlans.length ? featuredPlans.map((plan, index) => (
            <article
              className={`plan-card ${index === 1 ? "featured" : ""}`}
              key={plan.id || `${plan.days}-${plan.meals}`}
            >
              {index === 1 && <span className="plan-badge">الأكثر طلباً</span>}
              <h3>{plan.meals} وجبة يومياً</h3>
              <div className="plan-price">{plan.price} <small>د.أ / {plan.days} يوم</small></div>
              <div className="plan-meta">
                <span>✓ {plan.days} يوم اشتراك</span>
                <span>✓ توصيل شامل</span>
                <span>✓ اختيار الوجبات حسب القائمة</span>
              </div>
              <button onClick={onSubscriptions}>اختيار الباقة</button>
            </article>
          )) : <div className="home-empty">باقات الاشتراك متاحة من صفحة الاشتراكات.</div>}
        </div>
      </Reveal>
      <Reveal as="section" className="home-section">
        <div className="home-heading">
          <small>أرقام المطبخ</small>
          <h2>نظام بسيط... وطعم يُعتمد عليه</h2>
        </div>
        <div className="stats">
          <div className="stat">
            <AnimatedCounter end={26} />
            <span>يوم كحد أقصى للاشتراك المرن</span>
          </div>
          <div className="stat">
            <AnimatedCounter end={4} />
            <span>وجبات يومية متاحة في القائمة</span>
          </div>
          <div className="stat">
            <AnimatedCounter end={24} suffix="/7" />
            <span>الطلبات مفتوحة طوال اليوم</span>
          </div>
          <div className="stat">
            <AnimatedCounter end={100} suffix="%" />
            <span>اهتمام بالطعم والنظافة والتحضير</span>
          </div>
        </div>
      </Reveal>
      <Reveal as="section" className="home-section alt story-section">
        <div className="story">
          <div className="story-image">
            <img src={brandImages.story} alt="من مطبخ شيف نور" />
          </div>
          <div className="story-copy">
            <small>Our Story</small>
            <h2>قصتنا… من مطبخ بيتي إلى سفرتك</h2>
            <p>
              بدأت شيف نور من مطبخ بيتي صغير، ومن حب حقيقي للأكل الذي يجمع الناس حول السفرة.
              كل وجبة تُحضَّر يومياً بعناية، بطعم دافئ ومكونات واضحة، لنوصّل لك إحساس
              الأكل البيتي بطريقة مرتبة وسهلة، أينما كنت.
            </p>
            <button className="home-primary" onClick={onSubscriptions}>
              تعرّف على الاشتراكات
            </button>
          </div>
        </div>
      </Reveal>
      <Reveal as="section" className="home-cta">
        <img src={brandImages.cta} alt="" className="home-cta-photo" />
        <div className="home-cta-copy">
          <h2>أكلك اليوم... علينا</h2>
          <p>اشترك أو اطلب وجبة اليوم — والباقي على المطبخ.</p>
          <button onClick={onSubscriptions}>ابدأ اشتراكك</button>
        </div>
      </Reveal>
    </div>
  )
}
/* ======================================================
   SUBSCRIPTIONS
====================================================== */
function SubscriptionsPage({
  plans,
  onSelect,
}) {
  return (
    <section className="section subscriptions-page">
      <div className="section-title">
        <small>
          اختر الباقة المناسبة لك
        </small>
        <h2>
          اشتراكات مطبخ شيف نور
        </h2>
        <p>
          جميع أسعار الاشتراكات
          تشمل التوصيل.
        </p>
      </div>
      <SubscriptionPeriod days={26} plans={plans} onSelect={onSelect} />
      <SubscriptionPeriod days={20} plans={plans} onSelect={onSelect} />
    </section>
  )
}
function SubscriptionPeriod({
  days,
  plans,
  onSelect,
}) {
  return (
    <div className="period">
      <h3>
        📅 اشتراك {days} يوم
      </h3>
      <div className="plans">
        {plans
          .filter(
            (plan) =>
              plan.days === days
          )
          .map((plan) => (
            <Plan
              key={plan.id}
              plan={plan}
              onSelect={
                onSelect
              }
            />
          ))}
      </div>
    </div>
  )
}
/* ======================================================
   DAILY PAGE
====================================================== */
function DailyPage({
  onAddToCart,
  meals = [],
  tomorrowMeals = [],
  menuDate,
  tomorrowMenuDate,
  menuIsFallback,
  deliveryFee = 1,
}) {
  const formatArabicDate = (date) => date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("ar-JO", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : ""
  const renderMeals = (list, orderDate, emptyText) => {
    if (!list.length) {
      return <div className="empty modern-empty"><div>🍲</div>{emptyText}</div>
    }
    return (
      <div className="daily-menu-track">
        {list.map((meal, index) => (
          <div className="daily-meal-card" key={`${orderDate}-${meal.id}`}>
            <div className="daily-meal-photo">
              <img src={meal.image_url || mealFallbackImage(index)} alt={meal.name} />
            </div>
            <div className="daily-meal-copy">
              <div className="customer-head">
                <div>
                  <h3>{meal.name}</h3>
                  <span>{meal.description || "وجبة بيتية طازجة"}</span>
                </div>
                <span className="badge-active">متاحة</span>
              </div>
              <div className="customer-info">
                <div>
                  <small>💰 السعر</small>
                  <strong>{Number(meal.price || DAILY_PRICE).toFixed(2)} د.أ</strong>
                </div>
              </div>
              <button className="main-btn" onClick={() => onAddToCart(meal, 1, orderDate)}>
                أضف للسلة
              </button>
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <section className="section daily-section">
      <div className="section-title">
        <small>للطلب اليومي</small>
        <h2>🍲 وجبات اليوم والوجبات القادمة</h2>
        <p>اختر وجبة اليوم أو جهّز طلبك للغد، ثم أكمل بياناتك من السلة.</p>
      </div>

      <div className="modern-box daily-date-panel">
        <div className="box-title">
          <div><span>☀️</span><h3>وجبات اليوم</h3></div>
          <b className="status-online">{menuDate ? formatArabicDate(menuDate) : "غير منشورة"}</b>
        </div>
        {renderMeals(meals, menuDate || getAmmanNow().date, "لا توجد وجبات منشورة لليوم حالياً.")}
      </div>

      <div className="modern-box daily-date-panel">
        <div className="box-title">
          <div><span>📅</span><h3>وجبات الغد</h3></div>
          <b className={tomorrowMeals.length ? "status-online" : "badge-paused"}>
            {tomorrowMenuDate ? formatArabicDate(tomorrowMenuDate) : "غير منشورة بعد"}
          </b>
        </div>
        {renderMeals(tomorrowMeals, tomorrowMenuDate || "", "وجبات الغد لم تُنشر بعد. سيتم عرضها تلقائياً بعد نشرها من الإدارة وضمن وقت النشر المحدد.")}
      </div>

      <div className="closing">
        <span>🟢</span>
        <div>
          <strong>أضف إلى السلة ثم أكمل الطلب</strong>
          <p>توصيل الوجبات اليومية: {Number(deliveryFee).toFixed(2)} د.أ لكل طلب.</p>
        </div>
      </div>
    </section>
  )
}
function AdminDailyMenuScreen({ dailyMenu, loading, onRefresh }) {
  const formatArabicDate = (date) => {
    if (!date) return "-"
    return new Date(`${date}T00:00:00`).toLocaleDateString("ar-JO", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    })
  }
  const renderDay = (label, day) => (
    <div className="modern-box" style={{ marginBottom: "20px" }}>
      <div className="box-title">
        <div><span>{day?.is_holiday ? "🔴" : "🍽️"}</span><h3>{label}</h3></div>
        <b className={day?.is_published ? "status-online" : "badge-paused"}>
          {day?.is_published ? "منشور" : "غير منشور"}
        </b>
      </div>
      {!day ? (
        <div className="empty">لا توجد قائمة مسجلة لهذا اليوم.</div>
      ) : day.is_holiday ? (
        <div className="empty"><strong>اليوم عطلة</strong><p>{formatArabicDate(day.menu_date)}</p></div>
      ) : day.items?.length === 0 ? (
        <div className="empty">لا توجد وجبات محددة لهذا اليوم حتى الآن.</div>
      ) : (
        <div className="customers-grid">
          {day.items.map((item) => (
            <div className="customer-card" key={item.id}>
              {item.meals?.image_url ? (
                <img src={item.meals.image_url} alt={item.meals.name} style={{ width: "100%", height: "180px", objectFit: "cover", borderRadius: "16px", marginBottom: "12px" }} />
              ) : (
                <div className="avatar" style={{ marginBottom: "12px" }}>🍲</div>
              )}
              <div className="customer-head"><div><h3>{item.display_order}. {item.meals?.name}</h3><span>{item.available ? "متاحة" : "موقوفة"}</span></div></div>
            </div>
          ))}
        </div>
      )}
      {day && <div style={{ marginTop: "15px", textAlign: "center", opacity: 0.8 }}><small>{formatArabicDate(day.menu_date)}</small></div>}
    </div>
  )
  return (
    <div className="screen">
      <ScreenHeader icon="📅" title="القائمة اليومية" subtitle="عرض سريع لوجبات اليوم والغد كما حددها الأدمن" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
        <div><strong>ما الذي سيطبخه المطبخ؟</strong><p style={{ margin: "6px 0 0" }}>الغد يظهر هنا مباشرة من القائمة الشهرية.</p></div>
        <button className="refresh-btn" onClick={onRefresh} disabled={loading}>{loading ? "جاري التحديث..." : "🔄 تحديث القائمة"}</button>
      </div>
      {loading ? <div className="empty">جاري تحميل قائمة اليوم والغد...</div> : <>{renderDay("وجبات اليوم", dailyMenu?.today)}{renderDay("وجبات الغد", dailyMenu?.tomorrow)}</>}
    </div>
  )
}
/* ======================================================
   ADMIN
====================================================== */

function SiteSettingsScreen({ settings = DEFAULT_SITE_SETTINGS, saving, onSave }) {
  const [form, setForm] = useState({
    ...DEFAULT_SITE_SETTINGS,
    ...settings,
    footer_meal_images: Array.isArray(settings.footer_meal_images) ? [...settings.footer_meal_images] : [],
  })
  useEffect(() => {
    setForm({
      ...DEFAULT_SITE_SETTINGS,
      ...settings,
      footer_meal_images: Array.isArray(settings.footer_meal_images) ? [...settings.footer_meal_images] : [],
    })
  }, [settings])
  const change = (field, value) => setForm((old) => ({ ...old, [field]: value }))
  const changeFooterImage = (index, value) => {
    const images = [...(form.footer_meal_images || [])]
    images[index] = value
    setForm((old) => ({ ...old, footer_meal_images: images }))
  }
  return (
    <div className="screen">
      <ScreenHeader icon="⚙️" title="إعدادات الموقع" subtitle="تحكم كامل بالمعلومات والصور وروابط التواصل ووقت نشر الوجبات." />
      <div className="settings-grid">
        <div className="modern-box settings-card">
          <h3>📞 بيانات التواصل</h3>
          <label>رقم الاتصال</label>
          <input value={form.contact_phone || ""} onChange={(e) => change("contact_phone", e.target.value)} placeholder="07xxxxxxxx" />
          <label>رقم WhatsApp</label>
          <input value={form.whatsapp_phone || ""} onChange={(e) => change("whatsapp_phone", e.target.value)} placeholder="9627xxxxxxxx" />
          <small>اكتب رقم واتساب بصيغة دولية، مثال: 9627xxxxxxxx</small>
          <label>رابط Instagram</label>
          <input type="url" value={form.instagram_url || ""} onChange={(e) => change("instagram_url", e.target.value)} placeholder="https://instagram.com/..." />
          <label>رابط Facebook</label>
          <input type="url" value={form.facebook_url || ""} onChange={(e) => change("facebook_url", e.target.value)} placeholder="https://facebook.com/..." />
          <label>شعار/عبارة المطبخ</label>
          <input value={form.slogan || ""} onChange={(e) => change("slogan", e.target.value)} placeholder="أكل البيت... بطابع براند عالمي" />
        </div>

        <div className="modern-box settings-card">
          <h3>🕐 وقت عرض القوائم</h3>
          <p>المشترك يرى قائمة يوم العمل القادم فقط بعد نشرها من الإدارة وضمن هذه النافذة. يوم الجمعة يتجاوز تلقائياً إلى السبت.</p>
          <label>وقت بدء عرض قائمة الغد</label>
          <input type="time" value={form.menu_publish_time || "12:00"} onChange={(e) => change("menu_publish_time", e.target.value)} />
          <label>وقت إيقاف العرض/الاختيار</label>
          <input type="time" value={form.menu_stop_time || "23:00"} onChange={(e) => change("menu_stop_time", e.target.value)} />
          <label>رسوم توصيل الوجبات اليومية</label>
          <input type="number" min="0" step="0.25" value={form.daily_delivery_fee ?? 1} onChange={(e) => change("daily_delivery_fee", e.target.value)} />
          <div className="settings-note">الاشتراكات: التوصيل مشمول. الوجبات اليومية: الرسوم تُضاف مرة واحدة على الطلب.</div>
        </div>

        <div className="modern-box settings-card settings-card-wide">
          <h3>🖼️ صور واجهة الموقع</h3>
          <p>يمكنك تغيير الصور من الإدارة بمجرد وضع رابط الصورة وحفظ الإعدادات.</p>
          {[
            ["hero_image_url", "الصورة الرئيسية"],
            ["circle_image_url", "الصورة الدائرية"],
            ["story_image_url", "صورة قسم القصة"],
            ["cta_image_url", "صورة القسم الأخير"],
          ].map(([field, label]) => (
            <div className="settings-image-row" key={field}>
              <label>{label}</label>
              <input type="url" value={form[field] || ""} onChange={(e) => change(field, e.target.value)} placeholder="https://..." />
              {form[field] && <img src={form[field]} alt={label} />}
            </div>
          ))}
        </div>

        <div className="modern-box settings-card settings-card-wide">
          <h3>🍽️ الصور الست الأخيرة</h3>
          <p>هذه الصور تظهر في أسفل الصفحة. الوجبات اليومية نفسها تستخدم صورة الوجبة من قسم «الوجبات».</p>
          <div className="settings-footer-images">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="settings-image-row">
                <label>الصورة {index + 1}</label>
                <input type="url" value={form.footer_meal_images?.[index] || ""} onChange={(e) => changeFooterImage(index, e.target.value)} placeholder="https://..." />
                {form.footer_meal_images?.[index] && <img src={form.footer_meal_images[index]} alt={`صورة ${index + 1}`} />}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="settings-save-bar">
        <button className="main-btn" disabled={saving} onClick={() => onSave(form)}>
          {saving ? "جاري الحفظ..." : "💾 حفظ كل إعدادات الموقع"}
        </button>
      </div>
    </div>
  )
}

function AdminPage({
  meals,
  loadingMeals,
  onRefreshMeals,
  onAddMeal,
  onEditMeal,
  onDeleteMeal,
  onToggleMeal,
  onToggleAvailability,
  deletingMeal,
  dashboard,
  subscriptions,
  activeSubscriptions,
  dailyOrders,
  subscriberDailyMeals,
  loading,
  onRefresh,
  adminPage,
  setAdminPage,
  onUpdateOrderStatus,
  updatingOrder,
  onEditSubscription,
  onToggleSubscription,
  updatingSubscription,
  adminDailyMenu,
  loadingAdminDailyMenu,
  onRefreshAdminDailyMenu,
  menuMonth,
  menuDays,
  loadingMenuPlan,
  menuView,
  setMenuView,
  onLoadMenuPlan,
  onSelectMeal,
  onAddMealSlot,
  onRemoveMealSlot,
  onToggleHoliday,
  onSaveMenuDay,
  onPublishMenuDay,
  onUnpublishMenuDay,
  savingMenuDay,
  siteSettings,
  siteSettingsSaving,
  onSaveSiteSettings,
}) {
  return (
    <section className="admin-dashboard">
      <div className="admin-top">
        <div>
          <span>
            لوحة التحكم
          </span>
          <h2>
            👨‍🍳 مطبخ شيف نور
          </h2>
          <p>
            إدارة المشتركين والوجبات والطلبات
            والمطبخ والتوصيل.
          </p>
        </div>
        <button
          className="refresh-btn"
          onClick={onRefresh}
        >
          🔄 تحديث
        </button>
      </div>
      <div className="admin-menu">
        <button
          className={
            adminPage === "overview"
              ? "admin-menu-active"
              : ""
          }
          onClick={() =>
            setAdminPage("overview")
          }
        >
          <span>📊</span>
          <small>الرئيسية</small>
        </button>
        <button
          className={
            adminPage === "meals"
              ? "admin-menu-active"
              : ""
          }
          onClick={() => {
            setMenuView("planner")
            setAdminPage("meals")
          }}
        >
          <span>🍲</span>
          <small>الوجبات</small>
        </button>
        <button
          className={
            adminPage === "daily-menu"
              ? "admin-menu-active"
              : ""
          }
          onClick={() =>
            setAdminPage("daily-menu")
          }
        >
          <span>📅</span>
          <small>قائمة الغد</small>
        </button>
        <button
          className={
            adminPage === "customers"
              ? "admin-menu-active"
              : ""
          }
          onClick={() =>
            setAdminPage("customers")
          }
        >
          <span>👥</span>
          <small>المشتركين</small>
        </button>
        <button
          className={
            adminPage === "kitchen"
              ? "admin-menu-active"
              : ""
          }
          onClick={() =>
            setAdminPage("kitchen")
          }
        >
          <span>🍳</span>
          <small>المطبخ</small>
        </button>
        <button
          className={
            adminPage === "delivery"
              ? "admin-menu-active"
              : ""
          }
          onClick={() =>
            setAdminPage("delivery")
          }
        >
          <span>🚚</span>
          <small>التوصيل</small>
        </button>
        <button
          className={
            adminPage === "orders"
              ? "admin-menu-active"
              : ""
          }
          onClick={() =>
            setAdminPage("orders")
          }
        >
          <span>🛍️</span>
          <small>الطلبات</small>
        </button>
        <button
          className={adminPage === "settings" ? "admin-menu-active" : ""}
          onClick={() => setAdminPage("settings")}
        >
          <span>⚙️</span>
          <small>إعدادات الموقع</small>
        </button>
      </div>
      {adminPage === "settings" && (
        <SiteSettingsScreen
          settings={siteSettings}
          saving={siteSettingsSaving}
          onSave={onSaveSiteSettings}
        />
      )}
      {/* =========================
          OVERVIEW
      ========================= */}
      {adminPage === "overview" && (
        <AdminOverview
          dashboard={dashboard}
          activeSubscriptions={
            activeSubscriptions
          }
          dailyOrders={
            dailyOrders
          }
        />
      )}
      {/* =========================
          MEALS
      ========================= */}
      {adminPage === "meals" && (
        <MealsScreen
          meals={meals}
          loading={loadingMeals}
          onRefresh={onRefreshMeals}
          onAdd={onAddMeal}
          onEdit={onEditMeal}
          onDelete={onDeleteMeal}
          onToggle={onToggleMeal}
          onToggleAvailability={
            onToggleAvailability
          }
          deletingMeal={deletingMeal}
          menuMonth={menuMonth}
          menuDays={menuDays}
          loadingMenuPlan={loadingMenuPlan}
          menuView={menuView}
          setMenuView={setMenuView}
          onLoadMenuPlan={onLoadMenuPlan}
          onSelectMeal={onSelectMeal}
          onAddMealSlot={onAddMealSlot}
          onRemoveMealSlot={onRemoveMealSlot}
          onToggleHoliday={onToggleHoliday}
          onSaveMenuDay={onSaveMenuDay}
          onPublishMenuDay={onPublishMenuDay}
          onUnpublishMenuDay={onUnpublishMenuDay}
          savingMenuDay={savingMenuDay}
        />
      )}
      {/* =========================
          DAILY MENU
      ========================= */}
      {adminPage === "daily-menu" && (
        <AdminDailyMenuScreen
          dailyMenu={adminDailyMenu}
          loading={loadingAdminDailyMenu}
          onRefresh={onRefreshAdminDailyMenu}
        />
      )}
      {/* =========================
          CUSTOMERS
      ========================= */}
      {adminPage === "customers" && (
        <CustomersScreen
          subscriptions={
            subscriptions
          }
          loading={loading}
          onEdit={
            onEditSubscription
          }
          onToggle={
            onToggleSubscription
          }
          updating={
            updatingSubscription
          }
        />
      )}
      {/* =========================
          KITCHEN
      ========================= */}
      {adminPage === "kitchen" && (
        <KitchenScreen
          dashboard={dashboard}
          activeSubscriptions={
            activeSubscriptions
          }
          dailyOrders={
            dailyOrders
          }
        />
      )}
      {/* =========================
          DELIVERY
      ========================= */}
      {adminPage === "delivery" && (
        <DeliveryScreen
  dailyOrders={
    dailyOrders
  }
  subscriberDailyMeals={
    subscriberDailyMeals
  }
  activeSubscriptions={
    activeSubscriptions
  }
 
  updating={
    updatingOrder
  }
  profile={profile}
  onRefresh={loadDashboard}
/>
      )}
      {/* =========================
          ORDERS
      ========================= */}
      {adminPage === "orders" && (
        <OrdersScreen
          dailyOrders={
            dailyOrders
          }
          onUpdate={
            onUpdateOrderStatus
          }
          updating={
            updatingOrder
          }
        />
      )}
    </section>
  )
}
/* ======================================================
   MEALS SCREEN
====================================================== */
function MealsScreen({
  meals,
  loading,
  onRefresh,
  onAdd,
  onEdit,
  onDelete,
  onToggle,
  onToggleAvailability,
  deletingMeal,
  menuMonth,
  menuDays,
  loadingMenuPlan,
  menuView,
  setMenuView,
  onLoadMenuPlan,
  onSelectMeal,
  onAddMealSlot,
  onRemoveMealSlot,
  onToggleHoliday,
  onSaveMenuDay,
  onPublishMenuDay,
  onUnpublishMenuDay,
  savingMenuDay,
}) {
  const formatArabicDate = (date) => {
    if (!date) return "-"
    return new Date(`${date}T00:00:00`).toLocaleDateString("ar-JO", {
      weekday: "short",
      day: "numeric",
      month: "numeric",
      year: "numeric",
    })
  }
  const availableMeals = meals.filter(
    (meal) => meal.active && meal.is_available
  )
  return (
    <div className="screen">
      <ScreenHeader
        icon="🍲"
        title="جدول الوجبات"
        subtitle="إدارة وجبات 30 يوم — 4 وجبات افتراضية مع إمكانية الزيادة أو النقصان"
        count={menuDays.length === 30 ? 30 : 0}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "18px",
        }}
      >
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            className={menuView === "planner" ? "main-btn" : "refresh-btn"}
            onClick={() => setMenuView("planner")}
          >
            📅 جدول 30 يوم
          </button>
          <button
            className={menuView === "library" ? "main-btn" : "refresh-btn"}
            onClick={() => setMenuView("library")}
          >
            🍲 مكتبة الوجبات ({meals.length})
          </button>
        </div>
        {menuView === "planner" && (
          <div style={{ fontWeight: 700 }}>
            {loadingMenuPlan
              ? "جاري تجهيز الجدول..."
              : menuMonth
              ? `${menuMonth.start_date} → ${menuMonth.end_date}`
              : "جاري التحميل..."}
          </div>
        )}
      </div>
      {menuView === "planner" ? (
        <>
          <div className="modern-box" style={{ marginBottom: "16px" }}>
            <div className="box-title">
              <div>
                <span>📅</span>
                <div>
                  <h3>{menuMonth?.name || "جدول الوجبات"}</h3>
                  <small>
                    يتم إنشاء 30 يوم تلقائيًا، مع تحديد 4 وجبات افتراضية لكل يوم عمل، ويمكنك زيادة أو تقليل العدد حسب الحاجة.
                  </small>
                </div>
              </div>
              <b className="badge-paused">مسودة</b>
            </div>
            <p style={{ margin: "8px 0 0" }}>
              عدّل أي وجبة من القائمة مباشرة. احفظ اليوم بعد التعديل، ثم انشره عندما يكون جاهزًا.
            </p>
          </div>
          {loadingMenuPlan ? (
            <div className="empty">جاري تجهيز جدول الـ30 يوم...</div>
          ) : menuDays.length !== 30 ? (
            <div className="empty modern-empty">
              <div>📅</div>
              <strong>لم يتم تحميل جدول الـ30 يوم</strong>
              <p>أعد فتح قسم الوجبات أو حدّث الصفحة.</p>
              <button
                className="main-btn"
                onClick={onLoadMenuPlan}
                disabled={loadingMenuPlan}
              >
                🔄 تحميل الجدول
              </button>
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
                background: "#fff",
                borderRadius: "18px",
                border: "1px solid #e8e8e8",
                boxShadow: "0 8px 24px rgba(0,0,0,.05)",
              }}
            >
              <table
                style={{
                  width: "100%",
                  minWidth: "1050px",
                  borderCollapse: "collapse",
                  direction: "rtl",
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>اليوم</th>
                    <th style={thStyle}>التاريخ</th>
                    <th style={thStyle}>الوجبات</th>
                    <th style={thStyle}>الحالة</th>
                    <th style={thStyle}>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {menuDays.map((day) => {
                    const dayItems = day.items || []
                    const safeItems = dayItems.length ? dayItems : []
                    return (
                      <tr key={day.id}>
                        <td style={tdStyle}>
                          <strong>#{day.day_number}</strong>
                        </td>
                        <td style={tdStyle}>
                          <strong>{formatArabicDate(day.menu_date)}</strong>
                          {day.is_holiday && (
                            <div style={{ color: "#b42318", marginTop: "4px", fontWeight: 800 }}>
                              عطلة الجمعة
                            </div>
                          )}
                        </td>
                        <td style={{ ...tdStyle, minWidth: "520px" }}>
                          {day.is_holiday ? (
                            <span style={{ fontWeight: 800, color: "#b42318" }}>🔴 عطلة الجمعة</span>
                          ) : (
                            <div style={{ display: "grid", gap: "8px" }}>
                              {safeItems.map((item, index) => (
                                <div key={item.id || `${day.id}-${index}`} style={{ display: "flex", gap: "7px", alignItems: "center" }}>
                                  <span style={{ minWidth: "28px", fontWeight: 800 }}>{index + 1}</span>
                                  <select
                                    value={item?.meal_id || ""}
                                    onChange={(e) => onSelectMeal(day.id, index + 1, e.target.value)}
                                    style={selectStyle}
                                  >
                                    <option value="">اختر الوجبة</option>
                                    {availableMeals.map((meal) => (
                                      <option key={meal.id} value={meal.id}>{meal.name}</option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    className="delete-btn"
                                    onClick={() => onRemoveMealSlot(day.id, index)}
                                    title="حذف الوجبة من هذا اليوم"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                                <button type="button" className="refresh-btn" onClick={() => onAddMealSlot(day.id)}>➕ إضافة وجبة</button>
                                <span style={{ fontWeight: 700 }}>عدد الوجبات: {safeItems.length}</span>
                              </div>
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <span
                            className={
                              day.is_published
                                ? "status-online"
                                : "badge-paused"
                            }
                            style={{ display: "inline-block" }}
                          >
                            {day.is_published ? "منشور" : "مسودة"}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, minWidth: "190px" }}>
                          <div style={{ display: "grid", gap: "7px" }}>
                            <button
                              className={day.is_holiday ? "main-btn" : "refresh-btn"}
                              onClick={() => onToggleHoliday(day.id)}
                            >
                              {day.is_holiday ? "🔴 عطلة" : "✅ يوم عمل"}
                            </button>
                            <button
                              className="main-btn"
                              onClick={() => onSaveMenuDay(day)}
                              disabled={savingMenuDay === day.id}
                            >
                              {savingMenuDay === day.id
                                ? "جاري الحفظ..."
                                : "💾 حفظ"}
                            </button>
                            {day.is_published ? (
                              <button
                                className="refresh-btn"
                                onClick={() => onUnpublishMenuDay(day)}
                              >
                                إلغاء النشر
                              </button>
                            ) : (
                              <button
                                className="refresh-btn"
                                onClick={() => onPublishMenuDay(day)}
                                disabled={savingMenuDay === day.id}
                              >
                                📢 نشر
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="meal-admin-actions" style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
            <button className="main-btn" onClick={onAdd}>➕ إضافة وجبة</button>
            <button className="refresh-btn" onClick={onRefresh}>🔄 تحديث الوجبات</button>
          </div>
          {loading ? (
            <div className="empty">جاري تحميل الوجبات...</div>
          ) : meals.length === 0 ? (
            <div className="empty modern-empty">
              <div>🍲</div>
              لا توجد وجبات مضافة حتى الآن.
            </div>
          ) : (
            <div className="customers-grid">
              {meals.map((meal) => (
                <div className="customer-card" key={meal.id}>
                  {meal.image_url ? (
                    <img
                      src={meal.image_url}
                      alt={meal.name}
                      style={{ width: "100%", height: "180px", objectFit: "cover", borderRadius: "15px", marginBottom: "15px" }}
                    />
                  ) : (
                    <div className="avatar" style={{ marginBottom: "15px" }}>🍲</div>
                  )}
                  <div className="customer-head">
                    <div>
                      <h3>{meal.name}</h3>
                      <span>{meal.description || "لا يوجد وصف"}</span>
                    </div>
                    <span className={meal.active && meal.is_available ? "badge-active" : "badge-paused"}>
                      {meal.active && meal.is_available ? "متاحة" : "متوقفة"}
                    </span>
                  </div>
                  <div className="customer-info">
                    <div><small>💰 السعر</small><strong>{meal.price || 0} د.أ</strong></div>
                    <div><small>🆔 رقم الوجبة</small><strong>{meal.id}</strong></div>
                  </div>
                  <div className="customer-actions">
                    <button className="edit-btn" onClick={() => onEdit(meal)}>✏️ تعديل</button>
                    <button className="pause-btn" onClick={() => onToggle(meal)}>{meal.active ? "⏸ إيقاف" : "▶️ تفعيل"}</button>
                    <button className="pause-btn" onClick={() => onToggleAvailability(meal)}>{meal.is_available ? "🚫 إخفاء" : "👁️ إظهار"}</button>
                    <button className="delete-btn" disabled={deletingMeal === meal.id} onClick={() => onDelete(meal)}>🗑️ حذف</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
const thStyle = {
  padding: "13px 10px",
  background: "#f7f7f7",
  borderBottom: "1px solid #e5e5e5",
  textAlign: "center",
  whiteSpace: "nowrap",
  fontWeight: 800,
}
const tdStyle = {
  padding: "10px 8px",
  borderBottom: "1px solid #eeeeee",
  verticalAlign: "middle",
  textAlign: "center",
}
const selectStyle = {
  width: "100%",
  minWidth: "190px",
  padding: "10px 11px",
  borderRadius: "10px",
  border: "1px solid #d8d8d8",
  background: "#fff",
  fontFamily: "inherit",
  fontSize: "14px",
}
/* ======================================================
   DAILY ORDER POPUP
====================================================== */
function DailyOrderPopup({
  meals,
  selectedMeal,
  setSelectedMeal,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  customerAddress,
  setCustomerAddress,
  onUseLocation,
  customerLocation,
  dailyQuantity,
  setDailyQuantity,
  dailySaving,
  onSave,
  onClose,
}) {
  const selectedPrice =
    Number(
      selectedMeal?.price ||
        DAILY_PRICE
    )
  return (
    <div className="popup-background">
      <div className="popup">
        <button
          className="close"
          onClick={onClose}
        >
          ×
        </button>
        <h2>
          🍲 طلب وجبة اليوم
        </h2>
        <label>
          اختر الوجبة
        </label>
        <select
          value={
            selectedMeal?.id ||
            ""
          }
          onChange={(e) => {
            const meal =
              meals.find(
                (item) =>
                  String(
                    item.id
                  ) ===
                  String(
                    e.target.value
                  )
              )
            setSelectedMeal(
              meal || null
            )
          }}
        >
          <option value="">
            اختر الوجبة
          </option>
          {meals.map(
            (meal) => (
              <option
                key={
                  meal.id
                }
                value={
                  meal.id
                }
              >
                {meal.name} -{" "}
                {meal.price ||
                  DAILY_PRICE}{" "}
                د.أ
              </option>
            )
          )}
        </select>
        {selectedMeal && (
          <div className="selected">
            <h3>
              {
                selectedMeal.name
              }
            </h3>
            <p>
              {
                selectedMeal.description ||
                "وجبة بيتية طازجة"
              }
            </p>
            <strong>
              {selectedPrice.toFixed(
                2
              )}{" "}
              د.أ
            </strong>
            <small>
              🚚 التوصيل غير شامل
            </small>
          </div>
        )}
        <input
          type="text"
          placeholder="الاسم الكامل"
          value={
            customerName
          }
          onChange={(e) =>
            setCustomerName(
              e.target.value
            )
          }
        />
        <input
          type="tel"
          placeholder="رقم الهاتف"
          value={
            customerPhone
          }
          onChange={(e) =>
            setCustomerPhone(
              e.target.value
            )
          }
        />
        <textarea
          placeholder="العنوان بالتفصيل: المنطقة، الشارع، البناية، الطابق، الشقة"
          value={customerAddress}
          onChange={(e) => setCustomerAddress(e.target.value)}
        />
        <div className="location-helper">
          <button type="button" className="secondary-btn" onClick={onUseLocation}>
            📍 {customerLocation?.latitude ? "تم تحديد الموقع ✓" : "تحديد موقعي على الخريطة"}
          </button>
          <a href={customerLocation?.latitude ? `https://www.google.com/maps?q=${customerLocation.latitude},${customerLocation.longitude}` : "https://www.google.com/maps"} target="_blank" rel="noreferrer">
            فتح Google Maps ↗
          </a>
          <small>الموقع اختياري، وإذا لم تحدده يكفي كتابة عنوان السكن بالتفصيل.</small>
        </div>
        <label className="quantity-label">
          عدد الوجبات
        </label>
        <input
          type="number"
          min="1"
          value={
            dailyQuantity
          }
          onChange={(e) =>
            setDailyQuantity(
              Math.max(
                1,
                Number(
                  e.target.value
                ) || 1
              )
            )
          }
        />
        <div className="order-total">
          الإجمالي:
          <strong>
            {" "}
            {(
              selectedPrice *
              dailyQuantity
            ).toFixed(
              2
            )}{" "}
            د.أ
          </strong>
        </div>
        <button
          className="confirm"
          onClick={onSave}
          disabled={
            dailySaving
          }
        >
          {dailySaving
            ? "جاري تسجيل الطلب..."
            : "تأكيد الطلب"}
        </button>
      </div>
    </div>
  )
}
function CheckoutPopup({
  cart,
  subtotal,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  customerAddress,
  setCustomerAddress,
  customerMapLink,
  setCustomerMapLink,
  customerNote,
  setCustomerNote,
  onUseLocation,
  customerLocation,
  checkoutSaving,
  onConfirm,
  onClose,
}) {
  return (
    <div className="popup-background">
      <div className="popup checkout-popup">
        <button className="close" onClick={onClose}>×</button>
        <h2>🛒 تأكيد الطلب</h2>
        <p className="checkout-subtitle">راجع السلة، ثم أدخل بيانات التوصيل والملاحظات.</p>
        <div className="checkout-items">
          {cart.map((item, index) => (
            <div className="checkout-item" key={item.cart_id || `${item.meal_id || item.plan_id}-${index}`}>
              <div>
                <strong>{item.meal_name}</strong>
                <small>{item.kind === "subscription" ? "باقة اشتراك — التوصيل شامل" : `${item.quantity} × ${Number(item.price).toFixed(2)} د.أ`}</small>
                {item.note && <small>📝 {item.note}</small>}
              </div>
              <strong>{Number(item.total).toFixed(2)} د.أ</strong>
            </div>
          ))}
        </div>
        <div className="checkout-total">
          <span>{cart.some((item) => item.kind !== "subscription") ? "الإجمالي شامل التوصيل" : "الإجمالي — الباقة شاملة التوصيل"}</span>
          <strong>{Number(subtotal).toFixed(2)} د.أ</strong>
        </div>
        <input type="text" placeholder="الاسم الكامل" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        <input type="tel" placeholder="رقم الهاتف" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        <textarea placeholder="تفاصيل السكن: المنطقة، الشارع، رقم البناية، الطابق، رقم الشقة وأي تفاصيل تساعد السائق" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
        <div className="location-helper">
          <button type="button" className="secondary-btn" onClick={onUseLocation}>📍 تحديد موقعي تلقائياً</button>
          <a href="https://www.google.com/maps" target="_blank" rel="noreferrer">فتح Google Maps ↗</a>
          {customerLocation?.latitude && <a href={`https://www.google.com/maps?q=${customerLocation.latitude},${customerLocation.longitude}`} target="_blank" rel="noreferrer">عرض موقعي المحدد</a>}
          <small>يمكنك فتح Google Maps، إسقاط دبوس على موقعك، ثم نسخ رابط المشاركة ولصقه في الخانة التالية. الموقع اختياري، والعنوان التفصيلي يكفي.</small>
        </div>
        <input type="url" placeholder="رابط موقعك من Google Maps (اختياري)" value={customerMapLink} onChange={(e) => setCustomerMapLink(e.target.value)} />
        <textarea placeholder="ملاحظات الطلب (اختياري): كمية الطعام، الكربوهيدرات، مكوّنات لا ترغب بها، أو أي طلب خاص." value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} />
        <button className="confirm" onClick={onConfirm} disabled={checkoutSaving || cart.length === 0}>
          {checkoutSaving ? "جاري تأكيد الطلب..." : "✅ تأكيد وإرسال الطلب"}
        </button>
      </div>
    </div>
  )
}
/* ======================================================
   ADMIN OVERVIEW
====================================================== */
function AdminOverview({
  dashboard,
  activeSubscriptions,
  dailyOrders,
}) {
  return (
    <>
      <div className="dashboard-cards">
        <DashboardCard
          icon="👥"
          title="المشتركين النشطين"
          value={
            activeSubscriptions.length
          }
        />
        <DashboardCard
          icon="🥘"
          title="وجبات المشتركين اليوم"
          value={
            dashboard.subscriberMeals
          }
        />
        <DashboardCard
          icon="🛍️"
          title="طلبات اليوم"
          value={
            dailyOrders.length
          }
        />
        <DashboardCard
          icon="🔥"
          title="إجمالي وجبات اليوم"
          value={
            dashboard.totalMeals
          }
          highlight
        />
      </div>
      <div className="overview-grid">
        <div className="modern-box">
          <div className="box-title">
            <div>
              <span>🍳</span>
              <h3>
                حالة المطبخ
              </h3>
            </div>
            <b className="status-online">
              ● يعمل
            </b>
          </div>
          <div className="big-number">
            {
              dashboard.totalMeals
            }
          </div>
          <p>
            وجبة مطلوبة اليوم
          </p>
        </div>
        <div className="modern-box">
          <div className="box-title">
            <div>
              <span>🚚</span>
              <h3>
                التوصيل
              </h3>
            </div>
            <b className="status-online">
              ● نشط
            </b>
          </div>
          <div className="big-number">
            {
              dailyOrders.filter(
                (o) =>
                  o.status ===
                    "preparing" ||
                  o.status ===
                    "confirmed"
              ).length
            }
          </div>
          <p>
            طلب قيد التجهيز /
            التوصيل
          </p>
        </div>
      </div>
    </>
  )
}
/* ======================================================
   CUSTOMERS
====================================================== */
function CustomersScreen({
  subscriptions,
  loading,
  onEdit,
  onToggle,
  updating,
}) {
  return (
    <div className="screen">
      <ScreenHeader
        icon="👥"
        title="إدارة المشتركين"
        subtitle="تعديل ومتابعة اشتراكات العملاء"
        count={
          subscriptions.length
        }
      />
      {loading ? (
        <div className="empty">
          جاري تحميل البيانات...
        </div>
      ) : subscriptions.length ===
        0 ? (
        <div className="empty">
          لا يوجد مشتركون حتى الآن.
        </div>
      ) : (
        <div className="customers-grid">
          {subscriptions.map(
            (
              subscription
            ) => {
              const total =
                Number(
                  subscription.total_meals ||
                    0
                )
              const used =
                Number(
                  subscription.used_meals ||
                    0
                )
              const remaining =
                Math.max(
                  0,
                  total -
                    used
                )
              return (
                <div
                  className="customer-card"
                  key={
                    subscription.id
                  }
                >
                  <div className="customer-head">
                    <div className="avatar">
                      {subscription.customer_name?.charAt(
                        0
                      ) ||
                        "؟"}
                    </div>
                    <div>
                      <h3>
                        {
                          subscription.customer_name
                        }
                      </h3>
                      <span>
                        📱{" "}
                        {
                          subscription.phone
                        }
                      </span>
                    </div>
                    <span
                      className={
                        subscription.status ===
                        "active"
                          ? "badge-active"
                          : "badge-paused"
                      }
                    >
                      {subscription.status ===
                      "active"
                        ? "فعال"
                        : subscription.status}
                    </span>
                  </div>
                  <div className="customer-info">
                    <div>
                      <small>
                        📍 العنوان
                      </small>
                      <strong>
                        {
                          subscription.address ||
                          "-"
                        }
                      </strong>
                    </div>
                    <div>
                      <small>
                        📅 الاشتراك
                      </small>
                      <strong>
                        {
                          subscription.plan_days
                        }{" "}
                        يوم
                      </strong>
                    </div>
                    <div>
                      <small>
                        🍲 يومياً
                      </small>
                      <strong>
                        {
                          subscription.meals_per_day
                        }{" "}
                        وجبة
                      </strong>
                    </div>
                    <div>
                      <small>
                        💰 السعر
                      </small>
                      <strong>
                        {
                          subscription.price
                        }{" "}
                        د.أ
                      </strong>
                    </div>
                  </div>
                  <div className="meal-progress">
                    <div>
                      <span>
                        الوجبات المتبقية
                      </span>
                      <strong>
                        {remaining}
                      </strong>
                    </div>
                    <div className="progress">
                      <span
                        style={{
                          width:
                            total >
                            0
                              ? `${Math.min(
                                  100,
                                  (used /
                                    total) *
                                    100
                                )}%`
                              : "0%",
                        }}
                      />
                    </div>
                  </div>
                  <div className="customer-actions">
                    <button
                      className="edit-btn"
                      onClick={() =>
                        onEdit(
                          subscription
                        )
                      }
                    >
                      ✏️ تعديل
                    </button>
                    <button
                      className="pause-btn"
                      disabled={
                        updating ===
                        subscription.id
                      }
                      onClick={() =>
                        onToggle(
                          subscription
                        )
                      }
                    >
                      {subscription.status ===
                      "active"
                        ? "⏸ إيقاف"
                        : "▶ تفعيل"}
                    </button>
                  </div>
                </div>
              )
            }
          )}
        </div>
      )}
    </div>
  )
}
/* ======================================================
   KITCHEN
====================================================== */
function KitchenScreen({
  dashboard,
  activeSubscriptions,
  dailyOrders,
  subscriberDailyMeals = [],
}) {
  // تجميع وجبات المشتركين حسب اسم الوجبة
  const mealSummary = subscriberDailyMeals.reduce(
    (summary, item) => {
      const mealName = item.meal_name || "وجبة غير محددة"
      const quantity = Number(item.quantity || 0)
      if (!summary[mealName]) {
        summary[mealName] = 0
      }
      summary[mealName] += quantity
      return summary
    },
    {}
  )
  const mealSummaryList = Object.entries(
    mealSummary
  ).sort((a, b) => b[1] - a[1])
  return (
    <div className="screen">
      <ScreenHeader
        icon="🍳"
        title="شاشة المطبخ"
        subtitle="كل ما يحتاجه فريق الطبخ اليوم"
      />
      {/* =========================
          إجمالي اليوم
      ========================= */}
      <div className="kitchen-hero">
        <div>
          <span>
            إجمالي المطلوب
          </span>
          <strong>
            {dashboard.totalMeals}
          </strong>
          <p>
            وجبة لهذا اليوم
          </p>
        </div>
        <div className="kitchen-icon">
          🍲
        </div>
      </div>
      {/* =========================
          الإحصائيات
      ========================= */}
      <div className="kitchen-stats">
        <div>
          <span>👥</span>
          <small>
            وجبات المشتركين
          </small>
          <strong>
            {dashboard.subscriberMeals}
          </strong>
        </div>
        <div>
          <span>🛍️</span>
          <small>
            الطلبات اليومية
          </small>
          <strong>
            {dashboard.dailyMeals}
          </strong>
        </div>
        <div>
          <span>👨‍🍳</span>
          <small>
            المشتركين
          </small>
          <strong>
            {activeSubscriptions.length}
          </strong>
        </div>
        <div>
          <span>🚚</span>
          <small>
            طلبات التوصيل
          </small>
          <strong>
            {dailyOrders.filter(
              (o) =>
                o.status !== "cancelled" &&
                o.status !== "delivered"
            ).length}
          </strong>
        </div>
      </div>
      <div className="kitchen-list">
        {/* =====================================
            ملخص وجبات المشتركين
        ===================================== */}
        <div className="modern-box">
          <div className="box-title">
            <div>
              <span>🥘</span>
              <h3>
                وجبات المشتركين اليوم
              </h3>
            </div>
          </div>
          <div className="kitchen-total-row">
            <span>
              إجمالي الوجبات
            </span>
            <strong>
              {dashboard.subscriberMeals}
            </strong>
          </div>
          {mealSummaryList.length === 0 ? (
            <div className="empty">
              لم يحدد المشتركون وجباتهم لهذا اليوم بعد.
            </div>
          ) : (
            <div className="subscriber-kitchen-meals">
              {mealSummaryList.map(
                ([mealName, quantity]) => (
                  <div
                    className="kitchen-meal-summary"
                    key={mealName}
                  >
                    <div>
                      <span className="meal-summary-icon">
                        🍽️
                      </span>
                      <strong>
                        {mealName}
                      </strong>
                    </div>
                    <strong className="meal-summary-quantity">
                      {quantity}
                      <small>
                        وجبة
                      </small>
                    </strong>
                  </div>
                )
              )}
            </div>
          )}
        </div>
        {/* =====================================
            تفاصيل المشتركين
        ===================================== */}
        <div className="modern-box">
          <div className="box-title">
            <div>
              <span>👥</span>
              <h3>
                تفاصيل المشتركين
              </h3>
            </div>
          </div>
          {activeSubscriptions.length === 0 ? (
            <div className="empty">
              لا يوجد مشتركون فعالون.
            </div>
          ) : (
            activeSubscriptions.map(
              (subscription) => {
                const customerMeals =
                  subscriberDailyMeals.filter(
                    (item) =>
                      Number(
                        item.subscription_id
                      ) ===
                      Number(
                        subscription.id
                      )
                  )
                const customerTotal =
                  customerMeals.reduce(
                    (
                      total,
                      item
                    ) =>
                      total +
                      Number(
                        item.quantity || 0
                      ),
                    0
                  )
                return (
                  <div
                    className="kitchen-order"
                    key={subscription.id}
                  >
                    <div>
                      <strong>
                        {subscription.customer_name}
                      </strong>
                      {customerMeals.length === 0 ? (
                        <span>
                          لم يحدد وجباته بعد
                        </span>
                      ) : (
                        <span>
                          {customerMeals.map(
                            (item, index) => (
                              <span
                                key={item.id}
                              >
                                {index > 0 && " • "}
                                {item.meal_name}
                                {" × "}
                                {item.quantity}
                              </span>
                            )
                          )}
                        </span>
                      )}
                      <small>
                        المجموع: {customerTotal} وجبة
                      </small>
                    </div>
                  </div>
                )
              }
            )
          )}
        </div>
        {/* =====================================
            الطلبات اليومية
        ===================================== */}
        <div className="modern-box">
          <div className="box-title">
            <div>
              <span>🛍️</span>
              <h3>
                الطلبات اليومية
              </h3>
            </div>
          </div>
          {dailyOrders.length === 0 ? (
            <div className="empty">
              لا توجد طلبات اليوم.
            </div>
          ) : (
            dailyOrders.map(
              (order) => (
                <div
                  className="kitchen-order"
                  key={order.id}
                >
                  <div>
                    <strong>
                      {order.customer_name}
                    </strong>
                    <span>
                      {order.meal_name}
                      {" - "}
                      {order.quantity}
                      {" "}
                      وجبة
                    </span>
                  </div>
                  <OrderStatus
                    status={order.status}
                  />
                </div>
              )
            )
          )}
        </div>
      </div>
    </div>
  )
}
/* ======================================================
   DELIVERY DISPATCH
====================================================== */
function DeliveryScreen({
  dailyOrders = [],
  subscriberDailyMeals = [],
  activeSubscriptions = [],
  onUpdate,
  updating,
  onRefresh,
  profile = null,
}) {
  const today = getToday()
  const [route, setRoute] = useState(null)
  const [stops, setStops] = useState([])
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [creatingRoute, setCreatingRoute] = useState(false)
  const [routeError, setRouteError] = useState("")
  const [driverLocation, setDriverLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const isDriver = profile?.role === "driver"

  const haversineKm = (aLat, aLng, bLat, bLng) => {
    if ([aLat,aLng,bLat,bLng].some((v) => v == null || Number.isNaN(Number(v)))) return Infinity
    const R = 6371
    const dLat = (Number(bLat)-Number(aLat))*Math.PI/180
    const dLng = (Number(bLng)-Number(aLng))*Math.PI/180
    const x = Math.sin(dLat/2)**2 + Math.cos(Number(aLat)*Math.PI/180)*Math.cos(Number(bLat)*Math.PI/180)*Math.sin(dLng/2)**2
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x))
  }

  const googleMapsUrl = (items) => {
    const coords = items.filter(x => x.latitude != null && x.longitude != null).map(x => `${x.latitude},${x.longitude}`)
    if (!coords.length) return "https://www.google.com/maps"
    const destination = coords[coords.length - 1]
    const waypoints = coords.slice(0, -1).join("|")
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""}&travelmode=driving`
  }

  const buildCandidates = () => {
    const subscriberMap = new Map()
    subscriberDailyMeals.forEach(item => {
      const sub = activeSubscriptions.find(x => Number(x.id) === Number(item.subscription_id))
      if (!sub || sub.status === "cancelled") return
      if (!subscriberMap.has(sub.id)) subscriberMap.set(sub.id, { type:"subscription", reference_id:sub.id, customer_name:sub.customer_name || "مشترك", phone:sub.phone || "", address:sub.address || "", latitude:sub.latitude, longitude:sub.longitude, status:item.delivery_status || "pending", meals:[] })
      subscriberMap.get(sub.id).meals.push(`${item.meal_name || "وجبة"} × ${item.quantity || 1}`)
    })
    const subscribers = [...subscriberMap.values()].filter(x => x.status !== "delivered")
    const orders = dailyOrders.filter(o => !["cancelled","delivered"].includes(o.status)).map(o => ({
      type:"order", reference_id:o.id, customer_name:o.customer_name || "طلب يومي", phone:o.phone || "", address:o.address || "", latitude:o.latitude, longitude:o.longitude, status:o.status || "pending", meals:[`${o.meal_name || "وجبة"} × ${o.quantity || 1}`]
    }))
    return [...subscribers, ...orders]
  }

  const loadRoute = async () => {
    setLoadingRoute(true); setRouteError("")
    try {
      const { data:r, error:re } = await supabase.from("delivery_routes").select("*").eq("route_date", today).maybeSingle()
      if (re) throw re
      if (!r) { setRoute(null); setStops([]); return }
      const { data:s, error:se } = await supabase.from("delivery_stops").select("*").eq("route_id", r.id).order("stop_order", { ascending:true })
      if (se) throw se
      setRoute(r); setStops(s || [])
    } catch (e) {
      console.error("DELIVERY ROUTE LOAD", e)
      setRouteError("تعذر تحميل مسار التوصيل. تأكد من تشغيل SQL الخاص بنظام التوصيل.")
    } finally { setLoadingRoute(false) }
  }

  useEffect(() => { loadRoute() }, [today, dailyOrders.length, subscriberDailyMeals.length])

  // صاحب المطبخ يشاهد آخر موقع للسائق تلقائياً. السائق نفسه يرسل الموقع من زر التحديث.
  useEffect(() => {
    if (isDriver || !route?.driver_id) return undefined
    let cancelled = false
    const poll = async () => {
      const { data } = await supabase
        .from("driver_locations")
        .select("latitude, longitude, recorded_at")
        .eq("driver_id", route.driver_id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!cancelled && data) setDriverLocation(data)
    }
    poll()
    const timer = window.setInterval(poll, 15000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [route?.driver_id, isDriver])

  const createSmartRoute = async () => {
    const candidates = buildCandidates()
    const withLocation = candidates.filter(x => x.latitude != null && x.longitude != null)
    if (!withLocation.length) { alert("لا يوجد أي عميل لديه موقع GPS محفوظ. اطلب من العملاء تحديد الموقع عند تأكيد الطلب."); return }
    setCreatingRoute(true); setRouteError("")
    try {
      const origin = driverLocation || null
      let ordered = [...withLocation]
      let googleOptimized = false
      try {
        const { data:googleData, error:googleError } = await supabase.functions.invoke("optimize-delivery-route", { body:{ origin, stops:withLocation } })
        if (!googleError && Array.isArray(googleData?.stops) && googleData.stops.length === withLocation.length) {
          ordered = googleData.stops; googleOptimized = true
        }
      } catch (_) { /* fallback below */ }
      if (!googleOptimized) {
        if (origin) {
          const result=[]; let current=origin; let pool=[...ordered]
          while(pool.length){ pool.sort((a,b)=>haversineKm(current.latitude,current.longitude,a.latitude,a.longitude)-haversineKm(current.latitude,current.longitude,b.latitude,b.longitude)); const next=pool.shift(); result.push(next); current=next }
          ordered = result
        } else {
          ordered.sort((a,b) => Number(a.longitude)-Number(b.longitude) || Number(a.latitude)-Number(b.latitude))
        }
      }
      const payload = { route_date:today, status:"active", driver_id:profile?.id || null, total_stops:ordered.length, started_at:null, completed_at:null }
      if (route?.id) {
        const { error } = await supabase.from("delivery_routes").update(payload).eq("id", route.id)
        if (error) throw error
        await supabase.from("delivery_stops").delete().eq("route_id", route.id)
      } else {
        const { data, error } = await supabase.from("delivery_routes").insert(payload).select().single()
        if (error) throw error
        setRoute(data)
      }
      const routeId = route?.id || (await supabase.from("delivery_routes").select("id").eq("route_date",today).single()).data?.id
      if (!routeId) throw new Error("لم يتم إنشاء مسار")
      const rows = ordered.map((x,i)=>({ route_id:routeId, stop_order:i+1, source_type:x.type, source_id:x.reference_id, customer_name:x.customer_name, phone:x.phone, address:x.address, latitude:x.latitude, longitude:x.longitude, status:x.status === "preparing" ? "ready" : "pending", eta_minutes:null, arrived_at:null, delivered_at:null }))
      const { error:ie } = await supabase.from("delivery_stops").insert(rows)
      if (ie) throw ie
      await loadRoute()
    } catch(e) { console.error(e); setRouteError(e.message || "تعذر إنشاء المسار") }
    finally { setCreatingRoute(false) }
  }

  const updateStop = async (stop, status) => {
    const patch = { status }
    if (status === "en_route" && !route?.started_at) patch.started_at = new Date().toISOString()
    if (status === "delivered") patch.delivered_at = new Date().toISOString()
    const { error } = await supabase.from("delivery_stops").update(patch).eq("id", stop.id)
    if (error) { alert("تعذر تحديث التوصيلة: " + error.message); return }
    if (stop.source_type === "order") await onUpdate?.(stop.source_id, status === "delivered" ? "delivered" : status === "en_route" ? "preparing" : "confirmed")
    else if (stop.source_type === "subscription") await supabase.from("subscription_daily_meals").update({ delivery_status: status === "delivered" ? "delivered" : status === "en_route" ? "preparing" : "confirmed" }).eq("subscription_id", stop.source_id).eq("meal_date", today)
    await loadRoute(); await onRefresh?.()
  }

  const shareNext = () => {
    const next = stops.find(s => !["delivered","cancelled"].includes(s.status))
    if (!next) return
    window.open(googleMapsUrl([{latitude:driverLocation?.latitude,longitude:driverLocation?.longitude}, next]), "_blank", "noopener,noreferrer")
  }

  const startLocationTracking = () => {
    if (!navigator.geolocation) { alert("الجهاز لا يدعم تحديد الموقع."); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(async pos => {
      const loc={latitude:pos.coords.latitude,longitude:pos.coords.longitude}
      setDriverLocation(loc)
      if (profile?.id) await supabase.from("driver_locations").insert({ driver_id:profile.id, latitude:loc.latitude, longitude:loc.longitude, recorded_at:new Date().toISOString() })
      setLocating(false)
    }, () => { setLocating(false); alert("اسمح للموقع بالوصول إلى GPS ثم أعد المحاولة.") }, {enableHighAccuracy:true, maximumAge:10000, timeout:10000})
  }

  const candidates = buildCandidates()
  const pending = stops.filter(s => !["delivered","cancelled"].includes(s.status))
  const completed = stops.filter(s => s.status === "delivered")
  const next = pending[0]
  const etaFor = (index) => {
    const ordered = pending
    const target = ordered[index] || ordered[0]
    if (!target) return null
    let from = driverLocation
    let minutes = 0
    const speedKmH = 30
    for (let i = 0; i <= index; i++) {
      const point = ordered[i]
      if (from && point?.latitude != null && point?.longitude != null) {
        const km = haversineKm(from.latitude, from.longitude, point.latitude, point.longitude)
        if (Number.isFinite(km)) minutes += Math.max(2, Math.round((km / speedKmH) * 60))
      } else {
        minutes += 8
      }
      from = point
    }
    return Math.max(1, minutes)
  }

  return <div className="screen delivery-dispatch">
    <ScreenHeader icon="🚚" title="مركز التوصيل" subtitle={isDriver ? "مسارك اليوم — أنجز كل نقطة ثم انتقل للتالية" : "ترتيب التوصيلات، متابعة السائق، والوقت المتوقع للوصول"} count={pending.length} />
    {routeError && <div className="alert error">{routeError}</div>}
    <div className="delivery-command-bar">
      <div><strong>{candidates.length}</strong><span>طلبات تحتاج توصيل</span></div>
      <div><strong>{completed.length}</strong><span>تم التسليم</span></div>
      <div><strong>{pending.length}</strong><span>متبقي بالمسار</span></div>
      <div><strong>{next ? `#${next.stop_order}` : "—"}</strong><span>النقطة التالية</span></div>
    </div>
    {driverLocation && !isDriver && (
      <div className="delivery-live-card">
        <strong>📡 موقع السائق الآن</strong>
        <span>{Number(driverLocation.latitude).toFixed(5)}, {Number(driverLocation.longitude).toFixed(5)}</span>
        {driverLocation.recorded_at && <small>آخر تحديث: {new Date(driverLocation.recorded_at).toLocaleTimeString("ar-JO", { hour: "2-digit", minute: "2-digit" })}</small>}
      </div>
    )}
    <div className="delivery-toolbar">
      <button className="primary" onClick={createSmartRoute} disabled={creatingRoute || loadingRoute}>{creatingRoute ? "جاري ترتيب المسار…" : "🧭 إنشاء / إعادة ترتيب المسار"}</button>
      <button onClick={startLocationTracking} disabled={locating}>{locating ? "جاري تحديد موقعك…" : "📍 تحديث موقعي كسائق"}</button>
      {next && <button onClick={shareNext}>🗺️ افتح التوصيلة التالية في Google Maps</button>}
      {route && <button onClick={() => window.open(googleMapsUrl(stops), "_blank", "noopener,noreferrer")}>🗺️ عرض المسار الكامل</button>}
      <button onClick={loadRoute}>↻ تحديث</button>
    </div>
    {route && <div className="delivery-route-summary"><div><b>مسار {today}</b><span>{route.status === "active" ? "نشط" : route.status}</span></div><div>{stops.length} نقاط · {route.route_source === "google" ? "Google Maps" : "ترتيب ذكي"}</div></div>}
    {!route ? <div className="empty modern-empty"><div>🧭</div><b>لم يتم إنشاء مسار اليوم بعد</b><p>اضغط «إنشاء / إعادة ترتيب المسار» ليتم ترتيب العملاء الذين لديهم GPS، ثم استخدم Google Maps للملاحة.</p></div> :
      <div className="delivery-route-list">{stops.map((stop,index) => {
        const isNext = stop.id === next?.id
        const statusLabel = stop.status === "delivered" ? "تم التسليم" : stop.status === "en_route" ? "في الطريق" : stop.status === "ready" ? "جاهز" : "بانتظار الانطلاق"
        const maps = stop.latitude != null ? `https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}&travelmode=driving` : null
        return <div className={`delivery-stop ${isNext ? "is-next" : ""} ${stop.status === "delivered" ? "is-done" : ""}`} key={stop.id}>
          <div className="stop-number">{stop.stop_order}</div>
          <div className="stop-main"><div className="stop-heading"><h3>{isNext ? "التوصيلة التالية" : `توصيلة ${stop.stop_order}`}</h3><span>{statusLabel}</span></div><div className="stop-private"><b>{stop.customer_name || "عميل"}</b><span>📍 {stop.address || "الموقع محفوظ GPS"}</span>{stop.phone && <span>📱 {stop.phone}</span>}</div><div className="stop-public-eta">الوقت المتوقع: <b>{stop.status === "delivered" ? "تم الوصول" : `حوالي ${etaFor(index)} دقيقة`}</b></div></div>
          <div className="stop-actions">{maps && <a href={maps} target="_blank" rel="noreferrer">🗺️ الخريطة</a>}{stop.status !== "delivered" && <>{stop.status !== "en_route" && <button onClick={() => updateStop(stop,"en_route")}>{isNext ? "🚚 ابدأ التوصيل" : "بدء"}</button>}<button className="success" onClick={() => updateStop(stop,"delivered")}>✅ تم التسليم</button></>}</div>
        </div>
      })}</div>}
    <div className="delivery-privacy-note">🔒 معلومات الاسم والعنوان ورقم الهاتف تظهر فقط للمستخدم المصرح له بالتوصيل. صفحة تتبع العميل يمكن أن تعرض حالة التوصيل والوقت المتوقع وموقع السائق فقط.</div>
  </div>
}
/* ======================================================
   ORDERS
====================================================== */
function OrdersScreen({
  dailyOrders,
  onUpdate,
  updating,
}) {
  return (
    <div className="screen">
      <ScreenHeader
        icon="🛍️"
        title="طلبات اليوم"
        subtitle="إدارة الطلبات اليومية وحالاتها"
        count={
          dailyOrders.length
        }
      />
      {dailyOrders.length ===
      0 ? (
        <div className="empty modern-empty">
          <div>🛍️</div>
          لا توجد طلبات يومية
          اليوم.
        </div>
      ) : (
        <div className="orders-list">
          {dailyOrders.map(
            (order) => (
              <div
                className="order-card"
                key={order.id}
              >
                <div className="order-main">
                  <div className="order-avatar">
                    🍲
                  </div>
                  <div>
                    <h3>
                      {
                        order.customer_name
                      }
                    </h3>
                    <p>
                      📱{" "}
                      {
                        order.phone
                      }
                    </p>
                    <p>
                      📍{" "}
                      {
                        order.address ||
                        "-"
                      }
                    </p>
                    <p>
                      🍲{" "}
                      {
                        order.meal_name
                      }
                    </p>
                  </div>
                </div>
                <div className="order-middle">
                  <strong>
                    {
                      order.quantity
                    }{" "}
                    وجبة
                  </strong>
                  <span>
                    {
                      order.total_price ||
                      0
                    }{" "}
                    د.أ
                  </span>
                </div>
                <div className="order-right">
                  <OrderStatus
                    status={
                      order.status
                    }
                  />
                  <OrderActions
                    order={
                      order
                    }
                    updating={
                      updating ===
                      order.id
                    }
                    onUpdate={
                      onUpdate
                    }
                  />
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
/* ======================================================
   SCREEN HEADER
====================================================== */
function ScreenHeader({
  icon,
  title,
  subtitle,
  count,
}) {
  return (
    <div className="screen-header">
      <div className="screen-icon">
        {icon}
      </div>
      <div>
        <h2>
          {title}
        </h2>
        <p>
          {subtitle}
        </p>
      </div>
      {count !==
        undefined && (
        <div className="screen-count">
          {count}
        </div>
      )}
    </div>
  )
}
/* ======================================================
   DASHBOARD CARD
====================================================== */
function DashboardCard({
  icon,
  title,
  value,
  highlight,
}) {
  return (
    <div
      className={
        highlight
          ? "dashboard-card highlight"
          : "dashboard-card"
      }
    >
      <div className="dashboard-icon">
        {icon}
      </div>
      <div>
        <small>
          {title}
        </small>
        <strong>
          {value}
        </strong>
      </div>
    </div>
  )
}
/* ======================================================
   ORDER STATUS
====================================================== */
function OrderStatus({
  status,
}) {
  const statuses = {
    pending:
      "🟡 قيد الانتظار",
    confirmed:
      "🔵 مؤكد",
    preparing:
      "👨‍🍳 قيد التجهيز",
    delivered:
      "🚚 تم التوصيل",
    cancelled:
      "❌ ملغي",
  }
  return (
    <span className="order-status">
      {statuses[status] ||
        status}
    </span>
  )
}
/* ======================================================
   ORDER ACTIONS
====================================================== */
function OrderActions({
  order,
  updating,
  onUpdate,
}) {
  if (updating) {
    return (
      <span className="updating">
        جاري التحديث...
      </span>
    )
  }
  if (
    order.status ===
    "pending"
  ) {
    return (
      <div className="order-actions">
        <button
          onClick={() =>
            onUpdate(
              order.id,
              "confirmed"
            )
          }
        >
          تأكيد
        </button>
        <button
          className="danger"
          onClick={() =>
            onUpdate(
              order.id,
              "cancelled"
            )
          }
        >
          إلغاء
        </button>
      </div>
    )
  }
  if (
    order.status ===
    "confirmed"
  ) {
    return (
      <div className="order-actions">
        <button
          onClick={() =>
            onUpdate(
              order.id,
              "preparing"
            )
          }
        >
          🍳 تجهيز
        </button>
        <button
          className="danger"
          onClick={() =>
            onUpdate(
              order.id,
              "cancelled"
            )
          }
        >
          إلغاء
        </button>
      </div>
    )
  }
  if (
    order.status ===
    "preparing"
  ) {
    return (
      <div className="order-actions">
        <button
          onClick={() =>
            onUpdate(
              order.id,
              "delivered"
            )
          }
        >
          🚚 توصيل
        </button>
        <button
          className="danger"
          onClick={() =>
            onUpdate(
              order.id,
              "cancelled"
            )
          }
        >
          إلغاء
        </button>
      </div>
    )
  }
  if (
    order.status ===
    "delivered"
  ) {
    return (
      <span className="done">
        ✅ تم التوصيل
      </span>
    )
  }
  return (
    <span className="cancelled">
      ❌ ملغي
    </span>
  )
}
/* ======================================================
   PLAN
====================================================== */
function Plan({
  plan,
  onSelect,
}) {
  const isBest = plan.days === 26 && plan.meals === 2
  return (
    <div className={`plan ${isBest ? "plan-best" : ""}`}>
      {isBest && (
        <span className="plan-best-badge">الأكثر طلباً</span>
      )}
      <div className="meal-number">
        {plan.meals}
      </div>
      <h3>
        {plan.meals === 1
          ? "وجبة واحدة يومياً"
          : plan.meals === 2
          ? "وجبتان يومياً"
          : "3 وجبات يومياً"}
      </h3>
      <p>
        لمدة {plan.days} يوم
      </p>
      <div className="price">
        {plan.price}
        <small>
          {" "}
          د.أ
        </small>
      </div>
      <div className="delivery">
        🚚 التوصيل شامل
      </div>
      <button
        onClick={() =>
          onSelect(plan)
        }
      >
        اشترك الآن
      </button>
    </div>
  )
}
/* ======================================================
   SUBSCRIPTION POPUP
====================================================== */
function SubscriptionPopup({
  selectedPlan,
  onAddToCart,
  onClose,
}) {
  if (!selectedPlan) return null
  return (
    <div className="popup-background">
      <div className="popup subscription-choice-popup">
        <button className="close" onClick={onClose}>×</button>
        <h2>📦 باقة الاشتراك</h2>
        <div className="selected">
          <h3>اشتراك {selectedPlan.days} يوم</h3>
          <p>{selectedPlan.meals} وجبة يومياً</p>
          <strong>{Number(selectedPlan.price).toFixed(2)} د.أ</strong>
          <small>🚚 شامل التوصيل</small>
        </div>
        <div className="subscription-popup-note">
          <strong>بعد تأكيد الطلب</strong>
          <p>سيظهر لك رابط اشتراكك الخاص، ومن خلاله تختار كل يوم فقط من الوجبات اليومية المنشورة من مطبخ شيف نور.</p>
        </div>
        <button className="confirm" onClick={() => onAddToCart({ plan: selectedPlan })}>
          إضافة الباقة إلى السلة 🛒
        </button>
      </div>
    </div>
  )
}
/* ======================================================
   EDIT SUBSCRIPTION POPUP
====================================================== */
function EditSubscriptionPopup({
  subscription,
  saving,
  onSave,
  onClose,
}) {
  const [form, setForm] =
    useState({
      customer_name:
        subscription.customer_name ||
        "",
      phone:
        subscription.phone ||
        "",
      address:
        subscription.address ||
        "",
      plan_days:
        subscription.plan_days ||
        26,
      meals_per_day:
        subscription.meals_per_day ||
        1,
      price:
        subscription.price ||
        0,
      status:
        subscription.status ||
        "active",
    })
  const change = (
    field,
    value
  ) => {
    setForm((old) => ({
      ...old,
      [field]: value,
    }))
  }
  return (
    <div className="popup-background">
      <div className="popup edit-popup">
        <button
          className="close"
          onClick={onClose}
        >
          ×
        </button>
        <div className="edit-title">
          <div className="edit-icon">
            ✏️
          </div>
          <div>
            <h2>
              تعديل المشترك
            </h2>
            <p>
              تعديل بيانات الاشتراك
            </p>
          </div>
        </div>
        <label>
          الاسم الكامل
        </label>
        <input
          value={
            form.customer_name
          }
          onChange={(e) =>
            change(
              "customer_name",
              e.target.value
            )
          }
        />
        <label>
          رقم الهاتف
        </label>
        <input
          value={
            form.phone
          }
          onChange={(e) =>
            change(
              "phone",
              e.target.value
            )
          }
        />
        <label>
          العنوان
        </label>
        <textarea
          value={
            form.address
          }
          onChange={(e) =>
            change(
              "address",
              e.target.value
            )
          }
        />
        <div className="edit-row">
          <div>
            <label>
              مدة الاشتراك
            </label>
            <select
              value={
                form.plan_days
              }
              onChange={(e) =>
                change(
                  "plan_days",
                  Number(
                    e.target.value
                  )
                )
              }
            >
              <option value={20}>
                20 يوم
              </option>
              <option value={26}>
                26 يوم
              </option>
            </select>
          </div>
          <div>
            <label>
              الوجبات يومياً
            </label>
            <select
              value={
                form.meals_per_day
              }
              onChange={(e) =>
                change(
                  "meals_per_day",
                  Number(
                    e.target.value
                  )
                )
              }
            >
              <option value={1}>
                1 وجبة
              </option>
              <option value={2}>
                2 وجبات
              </option>
              <option value={3}>
                3 وجبات
              </option>
            </select>
          </div>
        </div>
        <label>
          السعر
        </label>
        <input
          type="number"
          value={
            form.price
          }
          onChange={(e) =>
            change(
              "price",
              Number(
                e.target.value
              )
            )
          }
        />
        <label>
          حالة الاشتراك
        </label>
        <select
          value={
            form.status
          }
          onChange={(e) =>
            change(
              "status",
              e.target.value
            )
          }
        >
          <option value="active">
            فعال
          </option>
          <option value="paused">
            متوقف
          </option>
          <option value="cancelled">
            ملغي
          </option>
        </select>
        <button
          className="confirm"
          disabled={saving}
          onClick={() =>
            onSave(form)
          }
        >
          {saving
            ? "جاري الحفظ..."
            : "💾 حفظ التعديلات"}
        </button>
      </div>
    </div>
  )
}
/* ======================================================
   EXPORT
====================================================== */
function FeedbackPopup({ onClose }) {
  const [name, setName] = useState("")
  const [rating, setRating] = useState(5)
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (!message.trim()) {
      alert("اكتب ملاحظتك أولاً، وشكراً لمساعدتنا على التطور ❤️")
      return
    }
    setSaving(true)
    const payload = { customer_name: name.trim(), rating: Number(rating), message: message.trim() }
    try {
      const { error } = await supabase.from("feedback").insert(payload)
      if (error) throw error
      alert("شكراً لك ❤️ وصلت ملاحظتك بنجاح.")
    } catch (error) {
      console.error("FEEDBACK ERROR:", error)
      const key = "chefNoorFeedback"
      const current = JSON.parse(localStorage.getItem(key) || "[]")
      current.push({ ...payload, created_at: new Date().toISOString() })
      localStorage.setItem(key, JSON.stringify(current))
      alert("شكراً لك ❤️ تم حفظ ملاحظتك، وسنستفيد منها لتطوير الخدمة.")
    } finally {
      setSaving(false)
      setMessage("")
      onClose()
    }
  }
  return (
    <div className="popup-background">
      <div className="popup feedback-popup">
        <button className="close" onClick={onClose}>×</button>
        <h2>💬 ملاحظاتك تهمنا</h2>
        <p>شاركنا رأيك عن الأكل، الطلب، التوصيل أو أي فكرة تحب نشوفها في مطبخ شيف نور.</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك (اختياري)" />
        <label>تقييمك</label>
        <select value={rating} onChange={(e) => setRating(e.target.value)}>
          <option value={5}>★★★★★ ممتاز</option>
          <option value={4}>★★★★ جيد جداً</option>
          <option value={3}>★★★ جيد</option>
          <option value={2}>★★ يحتاج تحسين</option>
          <option value={1}>★ يحتاج تحسين كبير</option>
        </select>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="اكتب ملاحظتك أو اقتراحك هنا..." />
        <button className="confirm" disabled={saving} onClick={submit}>{saving ? "جاري الإرسال..." : "إرسال الملاحظة ❤️"}</button>
      </div>
    </div>
  )
}
function CartPopup({
  cart,
  subtotal,
  onClose,
  onUpdateQuantity,
  onRemove,
  onClear,
  onCheckout,
}) {
  return (
    <div className="popup-background">
      <div className="popup cart-popup">
        <button className="close" onClick={onClose}>×</button>
        <div className="cart-header">
          <span className="cart-icon">🛒</span>
          <div>
            <h2>سلة الطلب</h2>
            <p>{cart.length ? `${cart.length} عنصر في السلة` : "السلة فارغة"}</p>
          </div>
        </div>
        {cart.length > 0 && (
          <div className="cart-confirm-note">
            ✨ تم حفظ اختيارك في السلة. يرجى تأكيد الطلب من سلة مشترياتك لإرسال بياناتك إلى مطبخ شيف نور.
          </div>
        )}
        {cart.length === 0 ? (
          <div className="empty-cart">
            <div>🛒</div>
            <h3>السلة فارغة</h3>
            <p>اختر وجباتك أو باقتك وأضفها إلى السلة.</p>
            <button className="main-btn" onClick={onClose}>متابعة التصفح</button>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cart.map((item, index) => {
                const cartId = item.cart_id || item.meal_id || item.plan_id || index
                const isSubscription = item.kind === "subscription"
                return (
                  <div className="cart-item" key={cartId}>
                    <img src={item.image || mealFallbackImage(index)} alt={item.meal_name} />
                    <div className="cart-item-info">
                      <h3>{item.meal_name}</h3>
                      {isSubscription ? (
                        <>
                          <span>{item.plan_days} يوم • {item.meals_per_day} وجبة يومياً</span>
                          {item.mealSelections?.length > 0 && <small>وجبات اليوم الأول: {item.mealSelections.map((m) => `${m.meal_name} × ${m.quantity}`).join("، ")}</small>}
                          {item.note && <small>📝 {item.note}</small>}
                        </>
                      ) : (
                        <>
                          <span>{Number(item.price).toFixed(2)} د.أ / وجبة — التوصيل غير شامل</span>
                          {item.order_date && <small>📅 موعد الطلب: {new Date(`${item.order_date}T00:00:00`).toLocaleDateString("ar-JO", { weekday: "long", day: "numeric", month: "long" })}</small>}
                        </>
                      )}
                      <strong>{Number(item.total).toFixed(2)} د.أ</strong>
                    </div>
                    {!isSubscription && (
                      <div className="cart-quantity">
                        <button onClick={() => onUpdateQuantity(cartId, item.quantity - 1)}>−</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => onUpdateQuantity(cartId, item.quantity + 1)}>+</button>
                      </div>
                    )}
                    <button className="cart-remove" onClick={() => onRemove(cartId)}>حذف</button>
                  </div>
                )
              })}
            </div>
            <div className="cart-summary">
              <div><span>العناصر</span><strong>{cart.length}</strong></div>
              <div><span>توصيل الاشتراك</span><strong>شامل</strong></div>
              {cart.some((item) => item.kind !== "subscription") && <div><span>توصيل الوجبات اليومية</span><strong>1.00 د.أ</strong></div>}
              <div className="cart-total"><span>الإجمالي</span><strong>{Number(subtotal).toFixed(2)} د.أ</strong></div>
            </div>
            <div className="cart-actions">
              <button className="secondary-btn" onClick={onClear}>إفراغ السلة</button>
              <button className="main-btn" onClick={onCheckout}>متابعة وإكمال الطلب</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
export default App
