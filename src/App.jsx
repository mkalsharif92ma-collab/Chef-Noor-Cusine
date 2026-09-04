
import { useEffect, useState } from "react"
import "./App.css"
import { supabase } from "./supabase"
const plans = [
  { id: 1, days: 26, meals: 1, price: 90 },
  { id: 2, days: 26, meals: 2, price: 165 },
  { id: 3, days: 26, meals: 3, price: 220 },
  { id: 4, days: 20, meals: 1, price: 70 },
  { id: 5, days: 20, meals: 2, price: 110 },
  { id: 6, days: 20, meals: 3, price: 165 },
]
const DAILY_PRICE = 3
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
  onClose,
}) {
  const [dailyMeals, setDailyMeals] = useState([])
  const [tomorrowMeals, setTomorrowMeals] = useState([])
  const [selectedMeals, setSelectedMeals] = useState({})
  const [loadingDaily, setLoadingDaily] = useState(true)
  const [savingMeals, setSavingMeals] = useState(false)
  const today = new Date()
  const todayDate = getToday()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  // الجمعة عطلة، لذلك إذا كان الغد جمعة نختار للسبت
  if (tomorrow.getDay() === 5) {
    tomorrow.setDate(tomorrow.getDate() + 1)
  }
  const tomorrowDate = `${tomorrow.getFullYear()}-${String(
    tomorrow.getMonth() + 1
  ).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`
  const date = today.toLocaleDateString("ar-JO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const weekday = today.toLocaleDateString("ar-JO", {
    weekday: "long",
  })
  const tomorrowText = tomorrow.toLocaleDateString("ar-JO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const tomorrowWeekday = tomorrow.toLocaleDateString("ar-JO", {
    weekday: "long",
  })
  useEffect(() => {
    const loadDailyMeals = async () => {
      if (!subscription?.id) return
      setLoadingDaily(true)
      const [todayResult, tomorrowResult] = await Promise.all([
        supabase
          .from("subscription_daily_meals")
          .select("*")
          .eq("subscription_id", subscription.id)
          .eq("meal_date", todayDate)
          .order("created_at", { ascending: true }),
        supabase
          .from("subscription_daily_meals")
          .select("*")
          .eq("subscription_id", subscription.id)
          .eq("meal_date", tomorrowDate)
          .order("created_at", { ascending: true }),
      ])
      if (todayResult.error) {
        console.error(
          "TODAY DAILY MEALS ERROR:",
          todayResult.error
        )
        setDailyMeals([])
      } else {
        setDailyMeals(todayResult.data || [])
      }
      if (tomorrowResult.error) {
        console.error(
          "TOMORROW DAILY MEALS ERROR:",
          tomorrowResult.error
        )
        setTomorrowMeals([])
      } else {
        const data = tomorrowResult.data || []
        setTomorrowMeals(data)
        const selected = {}
        data.forEach((item) => {
          if (item.meal_id) {
            selected[item.meal_id] = Number(item.quantity || 1)
          }
        })
        setSelectedMeals(selected)
      }
      setLoadingDaily(false)
    }
    loadDailyMeals()
  }, [subscription?.id, todayDate, tomorrowDate])
  const todayUsed = dailyMeals.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  )
  const todayRemaining = Math.max(
    0,
    Number(subscription?.meals_per_day || 0) - todayUsed
  )
  const tomorrowSelectedCount = Object.values(
    selectedMeals
  ).reduce(
    (sum, quantity) => sum + Number(quantity || 0),
    0
  )
  const tomorrowRemaining = Math.max(
    0,
    Number(subscription?.meals_per_day || 0) -
      tomorrowSelectedCount
  )
  const changeMealQuantity = (mealId, change) => {
    setSelectedMeals((prev) => {
      const current = Number(prev[mealId] || 0)
      const max = Number(subscription?.meals_per_day || 0)
      let next = current + change
      if (next < 0) next = 0
      if (next > max) {
        next = max
      }
      const totalOther = Object.entries(prev)
        .filter(([id]) => String(id) !== String(mealId))
        .reduce(
          (sum, [, quantity]) =>
            sum + Number(quantity || 0),
          0
        )
      if (totalOther + next > max) {
        next = Math.max(0, max - totalOther)
      }
      const result = { ...prev }
      if (next === 0) {
        delete result[mealId]
      } else {
        result[mealId] = next
      }
      return result
    })
  }
  const saveTomorrowMeals = async () => {
    if (!subscription?.id) return
    const maxMeals = Number(
      subscription.meals_per_day || 0
    )
    if (tomorrowSelectedCount !== maxMeals) {
      alert(
        `يجب اختيار ${maxMeals} وجبة لليوم ${tomorrowWeekday}`
      )
      return
    }
    setSavingMeals(true)
    try {
      const { error: deleteError } = await supabase
        .from("subscription_daily_meals")
        .delete()
        .eq("subscription_id", subscription.id)
        .eq("meal_date", tomorrowDate)
      if (deleteError) {
        console.error(
          "DELETE TOMORROW MEALS ERROR:",
          deleteError
        )
        alert("تعذر تحديث الوجبات")
        return
      }
      const rows = Object.entries(selectedMeals)
        .map(([mealId, quantity]) => {
          const meal = availableMeals.find(
            (item) => String(item.id) === String(mealId)
          )
          if (!meal) return null
          return {
            subscription_id: subscription.id,
            meal_date: tomorrowDate,
            meal_id: meal.id,
            meal_name: meal.name,
            quantity: Number(quantity),
          }
        })
        .filter(Boolean)
      if (rows.length === 0) {
        alert("اختر الوجبات أولاً")
        return
      }
      const { data, error } = await supabase
        .from("subscription_daily_meals")
        .insert(rows)
        .select()
      if (error) {
        console.error(
          "SAVE TOMORROW MEALS ERROR:",
          error
        )
        alert("تعذر حفظ الوجبات")
        return
      }
      setTomorrowMeals(data || [])
      alert("تم حفظ وجباتك بنجاح ✅")
    } catch (error) {
      console.error(
        "SAVE TOMORROW MEALS ERROR:",
        error
      )
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
  const isFriday = today.getDay() === 5
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
              {subscription?.used_meals || 0}
            </strong>
          </div>
          <div>
            <span>المتبقي</span>
            <strong>
              {subscription?.remaining_meals || 0}
            </strong>
          </div>
        </div>
        <div className="today-meals-box">
          <strong>
            وجبات اليوم
          </strong>
          {isFriday ? (
            <p>
              اليوم الجمعة عطلة
            </p>
          ) : loadingDaily ? (
            <p>
              جاري تحميل وجباتك...
            </p>
          ) : (
            <>
              <div>
                المستخدم اليوم:
                <strong>{todayUsed}</strong>
              </div>
              <div>
                المتبقي اليوم:
                <strong>{todayRemaining}</strong>
              </div>
            </>
          )}
        </div>
        {/* =========================================
            اختيار وجبات اليوم القادم
        ========================================= */}
        {!isFriday && (
          <div className="subscriber-meal-selection">
            <div className="section-title">
              <small>
                اختيار الوجبات مسبقاً
              </small>
              <h3>
                اختر وجبات {tomorrowWeekday}
              </h3>
              <p>
                {tomorrowText}
              </p>
            </div>
            <div className="meal-selection-counter">
              <strong>
                اخترت {tomorrowSelectedCount} من{" "}
                {subscription?.meals_per_day || 0}
              </strong>
              <span>
                المتبقي للاختيار: {tomorrowRemaining}
              </span>
            </div>
            {availableMeals.length === 0 ? (
              <div className="empty-state">
                لا توجد وجبات متاحة حالياً.
              </div>
            ) : (
              <div className="subscriber-meals-grid">
                {availableMeals.map((meal) => {
                  const quantity = Number(
                    selectedMeals[meal.id] || 0
                  )
                  return (
                    <div
                      key={meal.id}
                      className={`subscriber-meal-card ${
                        quantity > 0
                          ? "selected"
                          : ""
                      }`}
                    >
                      {meal.image_url && (
                        <img
                          src={meal.image_url}
                          alt={meal.name}
                        />
                      )}
                      <div className="subscriber-meal-info">
                        <strong>
                          {meal.name}
                        </strong>
                        {meal.description && (
                          <p>
                            {meal.description}
                          </p>
                        )}
                      </div>
                      <div className="meal-quantity-control">
                        <button
                          type="button"
                          onClick={() =>
                            changeMealQuantity(
                              meal.id,
                              -1
                            )
                          }
                          disabled={quantity === 0}
                        >
                          −
                        </button>
                        <strong>
                          {quantity}
                        </strong>
                        <button
                          type="button"
                          onClick={() =>
                            changeMealQuantity(
                              meal.id,
                              1
                            )
                          }
                          disabled={
                            tomorrowSelectedCount >=
                            Number(
                              subscription?.meals_per_day ||
                                0
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <button
              type="button"
              className="primary-btn"
              onClick={saveTomorrowMeals}
              disabled={
                savingMeals ||
                tomorrowSelectedCount !==
                  Number(
                    subscription?.meals_per_day || 0
                  )
              }
            >
              {savingMeals
                ? "جاري الحفظ..."
                : "حفظ وجباتي"}
            </button>
          </div>
        )}
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
  const [ordersClosed, setOrdersClosed] =
    useState(false)
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
  /* ======================================================
     CLOSING TIME
  ====================================================== */
  const checkClosingTime = () => {
    const now = new Date()
    const currentMinutes =
      now.getHours() * 60 +
      now.getMinutes()
    setOrdersClosed(
      currentMinutes >= 16 * 60
    )
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
  const formatDateLocal = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

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

        while (slot <= 4 && available.length > usedMealIds.size) {
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

      const { error } = await supabase
        .from("daily_menu")
        .update({ is_published: true })
        .eq("id", day.id)
      if (error) throw error

      setMenuDays((prev) => prev.map((d) =>
        d.id === day.id ? { ...d, is_published: true } : d
      ))
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
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      // للمشترك: إذا كان اليوم التالي الجمعة، ننتقل إلى السبت
      const nextSubscriberDay = new Date(tomorrow)
      if (nextSubscriberDay.getDay() === 5) {
        nextSubscriberDay.setDate(nextSubscriberDay.getDate() + 1)
      }

      const formatDate = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

      const loadOneDay = async (date) => {
        const dateText = formatDate(date)
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

      const [todayMenu, tomorrowMenu] = await Promise.all([
        loadOneDay(today),
        loadOneDay(nextSubscriberDay),
      ])

      setPublishedDailyMenu(todayMenu)
      setPublishedTomorrowMenu(tomorrowMenu)
    } catch (error) {
      console.error("PUBLISHED MENU ERROR:", error)
      setPublishedDailyMenu(null)
      setPublishedTomorrowMenu(null)
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
     EFFECTS
  ====================================================== */
  useEffect(() => {
    checkClosingTime()
    const timer = setInterval(
      checkClosingTime,
      60000
    )
    return () => {
      clearInterval(timer)
    }
  }, [])
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

    if (page === "daily" || page === "subscriber") {
      loadPublishedMenu()
    }

    if (page === "daily") {
      loadMeals()
    }
  }, [page, adminPage])
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
  const saveSubscription = async () => {
    if (!selectedPlan) {
      return
    }
    if (
      !customerName.trim() ||
      !customerPhone.trim() ||
      !customerAddress.trim()
    ) {
      alert(
        "يرجى تعبئة الاسم ورقم الهاتف والعنوان"
      )
      return
    }
    setIsSaving(true)
    try {
      const location =
        await getCustomerLocation()
async function loadProfile(setProfile, setProfileLoading) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setProfile(null)
      return
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
    if (error) {
      console.error("PROFILE LOAD ERROR:", error)
      setProfile(null)
      return
    }
    setProfile(data)
  } catch (error) {
    console.error("PROFILE ERROR:", error)
    setProfile(null)
  } finally {
    setProfileLoading(false)
  }
}
      const startDate =
        new Date()
      const endDate =
        new Date(startDate)
      endDate.setDate(
        endDate.getDate() +
          selectedPlan.days -
          1
      )
      const formatDate =
        (date) =>
          `${date.getFullYear()}-${String(
            date.getMonth() + 1
          ).padStart(2, "0")}-${String(
            date.getDate()
          ).padStart(2, "0")}`
      const start =
        formatDate(startDate)
      const end =
        formatDate(endDate)
      const totalMeals =
        selectedPlan.days *
        selectedPlan.meals
      const {
        data,
        error,
      } = await supabase
        .from("subscriptions")
        .insert({
          customer_id: null,
          plan_id:
            selectedPlan.id,
          customer_name:
            customerName.trim(),
          phone:
            customerPhone.trim(),
          address:
            customerAddress.trim(),
          plan_days:
            selectedPlan.days,
          meals_per_day:
            selectedPlan.meals,
          price:
            selectedPlan.price,
          start_date:
            start,
          end_date:
            end,
          total_meals:
            totalMeals,
          used_meals: 0,
          remaining_meals:
            totalMeals,
tracking_token: generateTrackingToken(),
          status: "active",
          latitude:
            location.latitude,
          longitude:
            location.longitude,
        })
        .select()
        .single()
      if (error) {
        console.error(
          "SUBSCRIPTION ERROR:",
          error
        )
        alert(
          "حدث خطأ أثناء تسجيل الاشتراك:\n" +
            error.message
        )
        return
      }
      console.log(
        "SUBSCRIPTION CREATED:",
        data
      )
      const trackingUrl =
  `${window.location.origin}/?tracking=${data.tracking_token}`
setSubscriberData({
  ...data,
  trackingUrl,
})
setSelectedPlan(null)
setCustomerName("")
setCustomerPhone("")
setCustomerAddress("")
setPage("subscriber")
await loadDashboard()
    } catch (error) {
      console.error(
        "SAVE SUBSCRIPTION ERROR:",
        error
      )
      alert(
        "حدث خطأ أثناء تسجيل الاشتراك:\n" +
          error.message
      )
    } finally {
      setIsSaving(false)
    }
  }
  /* ======================================================
     OPEN DAILY ORDER
     تم تعديلها حتى تستقبل الوجبة التي ضغط عليها المستخدم
  ====================================================== */
  const openDailyOrder = (
    meal = null
  ) => {
    checkClosingTime()
    const now = new Date()
    const currentMinutes =
      now.getHours() * 60 +
      now.getMinutes()
    if (
      currentMinutes >=
      16 * 60
    ) {
      setOrdersClosed(true)
      alert(
        "الطلبات اليومية مغلقة بعد الساعة 4:00 عصراً."
      )
      return
    }
    const todayPublicMeals = publicTodayMeals

    if (todayPublicMeals.length === 0) {
      alert("لا توجد وجبات منشورة لليوم حالياً.")
      return
    }
    setDailyQuantity(1)
    /*
      إذا المستخدم ضغط على وجبة معينة
      نفتح نفس الوجبة.
      وإذا لم يتم تمرير وجبة نختار الأولى.
    */
    setSelectedDailyMeal(
      meal || todayPublicMeals[0]
    )
    setDailyOrderOpen(true)
  }
  /* ======================================================
     SAVE DAILY ORDER
  ====================================================== */
  const saveDailyOrder =
    async () => {
      const now = new Date()
      const currentMinutes =
        now.getHours() * 60 +
        now.getMinutes()
      if (
        currentMinutes >=
        16 * 60
      ) {
        setOrdersClosed(true)
        alert(
          "الطلبات اليومية مغلقة بعد الساعة 4:00 عصراً."
        )
        return
      }
      if (
        !customerName.trim() ||
        !customerPhone.trim() ||
        !customerAddress.trim()
      ) {
        alert(
          "يرجى تعبئة الاسم ورقم الهاتف والعنوان"
        )
        return
      }
      if (!selectedDailyMeal) {
        alert(
          "يرجى اختيار الوجبة"
        )
        return
      }
      const quantity =
        Number(dailyQuantity)
      if (
        !quantity ||
        quantity < 1
      ) {
        alert(
          "يرجى اختيار عدد الوجبات"
        )
        return
      }
      setDailySaving(true)
      try {
        const location =
          await getCustomerLocation()
        const today =
          getToday()
        const mealPrice =
          Number(
            selectedDailyMeal.price ||
              DAILY_PRICE
          )
        const totalPrice =
          mealPrice *
          quantity
        const {
          error,
        } = await supabase
          .from("daily_orders")
          .insert({
            customer_name:
              customerName.trim(),
            phone:
              customerPhone.trim(),
            address:
              customerAddress.trim(),
            meal_name:
              selectedDailyMeal.name,
            quantity,
            order_date:
              today,
            delivery_price: 0,
            total_price:
              totalPrice,
            status:
              "pending",
            latitude:
              location.latitude,
            longitude:
              location.longitude,
          })
        if (error) {
          console.error(
            "DAILY ORDER ERROR:",
            error
          )
          alert(
            "حدث خطأ أثناء تسجيل الطلب:\n" +
              error.message
          )
          return
        }
        alert(
          "تم تسجيل طلبك بنجاح ❤️"
        )
        setCustomerName("")
        setCustomerPhone("")
        setCustomerAddress("")
        setDailyQuantity(1)
        setSelectedDailyMeal(null)
        setDailyOrderOpen(false)
        await loadDashboard()
      } catch (error) {
        console.error(error)
        alert(
          "حدث خطأ في الاتصال بقاعدة البيانات"
        )
      } finally {
        setDailySaving(false)
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

  // في يوم العطلة أو عندما لا تكون قائمة اليوم منشورة،
  // نعرض أقرب قائمة منشورة قادمة حتى لا تبقى الصفحة فارغة.
  const publicTodayMeals =
    todayPublishedItems.length > 0
      ? todayPublishedItems
      : tomorrowPublishedItems

  const publicTodayMenuDate =
    todayPublishedItems.length > 0
      ? publishedDailyMenu?.menu_date
      : publishedTomorrowMenu?.menu_date

  const publicTodayMenuIsFallback =
    todayPublishedItems.length === 0 &&
    tomorrowPublishedItems.length > 0

  const publicTomorrowMeals = tomorrowPublishedItems

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
/>
{page === "subscriber" && (
  <SubscriberPage
    subscription={subscriberData}
    availableMeals={publicTomorrowMeals}
    onClose={() => setPage("home")}
  />
)}
      {/* ==================================================
          HOME
      ================================================== */}
      {page === "home" && (
        <HomePage
          onSubscriptions={() =>
            setPage(
              "subscriptions"
            )
          }
          onDaily={() =>
            setPage("daily")
          }
        />
      )}
      {/* ==================================================
          SUBSCRIPTIONS
      ================================================== */}
      {page ===
        "subscriptions" && (
        <SubscriptionsPage
          plans={plans}
          onSelect={
            setSelectedPlan
          }
        />
      )}
{/* ==================================================
    SUBSCRIPTION POPUP
================================================== */}
{selectedPlan && (
  <SubscriptionPopup
    selectedPlan={selectedPlan}
    customerName={customerName}
    setCustomerName={setCustomerName}
    customerPhone={customerPhone}
    setCustomerPhone={setCustomerPhone}
    customerAddress={customerAddress}
    setCustomerAddress={setCustomerAddress}
    isSaving={isSaving}
    onSave={saveSubscription}
    onClose={() => {
      setSelectedPlan(null)
      setCustomerName("")
      setCustomerPhone("")
      setCustomerAddress("")
    }}
  />
)}
      {/* ==================================================
          DAILY
      ================================================== */}
      {page === "daily" && (
        <DailyPage
          meals={publicTodayMeals}
          menuDate={publicTodayMenuDate}
          menuIsFallback={publicTodayMenuIsFallback}
          ordersClosed={
            ordersClosed
          }
          onOrder={
            openDailyOrder
          }
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
      {/* ==================================================
          FOOTER
      ================================================== */}
      <footer>
        <h2>
          مطبخ شيف نور
        </h2>
        <p>
          Chef Noor Cuisine
        </p>
        <p>
          © 2026 جميع الحقوق محفوظة
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
}) {
  return (
    <header className="header">
      <div className="brand">
        <div className="brand-icon">
          🍲
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
      </nav>
    </header>
  )
}
/* ======================================================
   HOME
====================================================== */
function HomePage({
  onSubscriptions,
  onDaily,
}) {
  return (
    <section className="hero">
      <div className="hero-content">
        <div className="welcome">
          أهلاً وسهلاً بكم ❤️
        </div>
        <h2>
          طبخ بيتي
          <br />
          <strong>
            بطعم يحبّه الجميع
          </strong>
        </h2>
        <p>
          في مطبخ شيف نور نحضّر
          لكم وجبات منزلية طازجة
          كل يوم، بعناية وحب.
        </p>
        <div className="hero-buttons">
          <button
            className="main-btn"
            onClick={
              onSubscriptions
            }
          >
            📅 اشترك معنا
          </button>
          <button
            className="outline-btn"
            onClick={onDaily}
          >
            🍲 وجبات اليوم
          </button>
        </div>
      </div>
      <div className="hero-food">
        <div className="food-circle">
          <span>🍲</span>
          <h3>
            Chef Noor
          </h3>
          <p>
            طبخ بحب ❤️
          </p>
        </div>
      </div>
    </section>
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
    <section className="section">
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
      <SubscriptionPeriod
        days={26}
        plans={plans}
        onSelect={onSelect}
      />
      <SubscriptionPeriod
        days={20}
        plans={plans}
        onSelect={onSelect}
      />
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
  meals,
  menuDate,
  menuIsFallback,
  ordersClosed,
  onOrder,
}) {
  const formattedMenuDate = menuDate
    ? new Date(`${menuDate}T00:00:00`).toLocaleDateString(
        "ar-JO",
        {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }
      )
    : ""

  return (
    <section className="section daily-section">
      <div className="section-title">
        <small>
          للطلب اليومي
        </small>
        <h2>
          🍲 وجبات اليوم
        </h2>
        <p>
          {menuIsFallback
            ? `القائمة المنشورة القادمة — ${formattedMenuDate}`
            : formattedMenuDate
              ? `قائمة ${formattedMenuDate}`
              : "اختر الوجبة التي ترغب بها."}
        </p>
      </div>
      {meals.length === 0 ? (
        <div className="empty modern-empty">
          <div>🍲</div>
          لا توجد وجبات متاحة
          اليوم.
        </div>
      ) : (
        <div className="customers-grid">
          {meals.map(
            (meal) => (
              <div
                className="customer-card"
                key={meal.id}
              >
                {meal.image_url ? (
                  <img
                    src={
                      meal.image_url
                    }
                    alt={
                      meal.name
                    }
                    style={{
                      width:
                        "100%",
                      height:
                        "220px",
                      objectFit:
                        "cover",
                      borderRadius:
                        "16px",
                      marginBottom:
                        "15px",
                    }}
                  />
                ) : (
                  <div
                    className="avatar"
                    style={{
                      marginBottom:
                        "15px",
                    }}
                  >
                    🍲
                  </div>
                )}
                <div className="customer-head">
                  <div>
                    <h3>
                      {meal.name}
                    </h3>
                    <span>
                      {meal.description ||
                        "وجبة بيتية طازجة"}
                    </span>
                  </div>
                  <span className="badge-active">
                    متاحة
                  </span>
                </div>
                <div className="customer-info">
                  <div>
                    <small>
                      💰 السعر
                    </small>
                    <strong>
                      {meal.price ||
                        DAILY_PRICE}{" "}
                      د.أ
                    </strong>
                  </div>
                </div>
                <button
                  className="main-btn"
                  disabled={
                    ordersClosed
                  }
                  onClick={() =>
                    onOrder(meal)
                  }
                >
                  {ordersClosed
                    ? "🔴 انتهى وقت الطلب"
                    : "اطلب هذه الوجبة"}
                </button>
              </div>
            )
          )}
        </div>
      )}
      <div className="closing">
        <span>⏰</span>
        <div>
          <strong>
            {ordersClosed
              ? "الطلبات مغلقة"
              : "الطلبات مفتوحة"}
          </strong>
          <p>
            يتم إغلاق الطلبات
            الساعة 4:00 عصراً
          </p>
        </div>
        <b
          className={
            ordersClosed
              ? "closed"
              : "open"
          }
        >
          {ordersClosed
            ? "🔴 مغلق"
            : "🟢 مفتوح"}
        </b>
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
      </div>
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
          placeholder="عنوان التوصيل"
          value={
            customerAddress
          }
          onChange={(e) =>
            setCustomerAddress(
              e.target.value
            )
          }
        />
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
   DELIVERY
====================================================== */
function DeliveryScreen({
  dailyOrders,
  subscriberDailyMeals = [],
  activeSubscriptions = [],
  onUpdate,
  updating,
  onRefresh,
}) {
  const today = getToday()
  /* ======================================================
     الطلبات اليومية العادية
  ====================================================== */
  const deliveryOrders =
    dailyOrders.filter(
      (order) =>
        order.status !== "cancelled" &&
        order.status !== "delivered"
    )
  /* ======================================================
     تجميع وجبات المشتركين حسب المشترك
  ====================================================== */
  const subscriberDeliveryMap =
    subscriberDailyMeals.reduce(
      (result, item) => {
        const subscription =
          activeSubscriptions.find(
            (sub) =>
              Number(sub.id) ===
              Number(item.subscription_id)
          )
        if (!subscription) {
          return result
        }
        const key =
          subscription.id
        if (!result[key]) {
          result[key] = {
            subscription,
            meals: [],
            totalMeals: 0,
            deliveryStatus:
              item.delivery_status ||
              "pending",
          }
        }
        result[key].meals.push(item)
        result[key].totalMeals +=
          Number(item.quantity || 0)
        /*
         * إذا كانت أي وجبة ما زالت في حالة
         * أبكر من الحالة الحالية، نحافظ على
         * الحالة المناسبة.
         */
        const statusOrder = {
          pending: 1,
          confirmed: 2,
          preparing: 3,
          delivered: 4,
        }
        const currentStatus =
          result[key].deliveryStatus
        const itemStatus =
          item.delivery_status ||
          "pending"
        if (
          statusOrder[itemStatus] >
          statusOrder[currentStatus]
        ) {
          result[key].deliveryStatus =
            itemStatus
        }
        return result
      },
      {}
    )
  const subscriberDeliveries =
    Object.values(
      subscriberDeliveryMap
    )
  /* ======================================================
     إجمالي طلبات التوصيل
  ====================================================== */
  const totalDeliveryCount =
    deliveryOrders.length +
    subscriberDeliveries.length
  /* ======================================================
     تحديث حالة توصيل المشترك
  ====================================================== */
  const updateSubscriberStatus =
    async (
      subscriptionId,
      status
    ) => {
      try {
        const {
          error,
        } = await supabase
          .from(
            "subscription_daily_meals"
          )
          .update({
            delivery_status:
              status,
          })
          .eq(
            "subscription_id",
            subscriptionId
          )
          .eq(
            "meal_date",
            today
          )
        if (error) {
          console.error(
            "SUBSCRIBER DELIVERY UPDATE ERROR:",
            error
          )
          alert(
            "حدث خطأ أثناء تحديث حالة التوصيل."
          )
          return
        }
        /*
         * تحديث البيانات في الشاشة
         * إذا كان onUpdate موجوداً
         */
        if (onRefresh) {
  await onRefresh()
}
        /*
         * تحديث الصفحة/البيانات بعد نجاح العملية
         */
        
      } catch (error) {
        console.error(
          "SUBSCRIBER DELIVERY ERROR:",
          error
        )
        alert(
          "حدث خطأ أثناء تحديث حالة التوصيل."
        )
      }
    }
  return (
    <div className="screen">
      <ScreenHeader
        icon="🚚"
        title="شاشة التوصيل"
        subtitle="متابعة جميع الطلبات المطلوب توصيلها اليوم"
        count={
          totalDeliveryCount
        }
      />
      {/* ==================================================
          إحصائيات التوصيل
      ================================================== */}
      <div className="kitchen-stats">
        <div>
          <span>👥</span>
          <small>توصيلات المشتركين</small>
          <strong>
            {subscriberDeliveries.length}
          </strong>
        </div>
        <div>
          <span>🛍️</span>
          <small>الطلبات اليومية</small>
          <strong>
            {deliveryOrders.length}
          </strong>
        </div>
        <div>
          <span>🍲</span>
          <small>وجبات المشتركين</small>
          <strong>
            {subscriberDeliveries.reduce(
              (
                total,
                item
              ) =>
                total +
                item.totalMeals,
              0
            )}
          </strong>
        </div>
        <div>
          <span>🚚</span>
          <small>إجمالي التوصيلات</small>
          <strong>
            {totalDeliveryCount}
          </strong>
        </div>
      </div>
      {/* ==================================================
          لا يوجد أي طلب
      ================================================== */}
      {totalDeliveryCount === 0 ? (
        <div className="empty modern-empty">
          <div>🚚</div>
          لا توجد طلبات جاهزة
          للتوصيل اليوم.
        </div>
      ) : (
        <div className="delivery-grid">
          {/* ==================================================
              توصيلات المشتركين
          ================================================== */}
          {subscriberDeliveries.map(
            ({
              subscription,
              meals,
              totalMeals,
              deliveryStatus,
            }) => (
              <div
                className="delivery-card"
                key={`subscription-${subscription.id}`}
              >
                <div className="delivery-top">
                  <div className="delivery-number">
                    مشترك
                  </div>
                  <OrderStatus
                    status={
                      deliveryStatus
                    }
                  />
                </div>
                <h3>
                  {
                    subscription.customer_name
                  }
                </h3>
                <div className="delivery-info">
                  <p>
                    📱{" "}
                    <strong>
                      {
                        subscription.phone ||
                        "-"
                      }
                    </strong>
                  </p>
                  <p>
                    📍{" "}
                    <strong>
                      {
                        subscription.address ||
                        "-"
                      }
                    </strong>
                  </p>
                  <p>
                    🍲{" "}
                    <strong>
                      {meals.map(
                        (
                          meal,
                          index
                        ) => (
                          <span
                            key={meal.id}
                          >
                            {index > 0 &&
                              " • "}
                            {
                              meal.meal_name
                            }
                            {" × "}
                            {
                              meal.quantity
                            }
                          </span>
                        )
                      )}
                    </strong>
                  </p>
                  <p>
                    🔢{" "}
                    <strong>
                      {totalMeals} وجبة
                    </strong>
                  </p>
                  <p>
                    📅{" "}
                    <strong>
                      {today}
                    </strong>
                  </p>
                  <p>
                    🏷️{" "}
                    <strong>
                      اشتراك{" "}
                      {
                        subscription.plan_name ||
                        ""
                      }
                    </strong>
                  </p>
                </div>
                {/* ==========================================
                    أزرار حالة توصيل المشترك
                ========================================== */}
                <div className="delivery-actions">
                  {deliveryStatus ===
                    "pending" && (
                    <button
                      onClick={() =>
                        updateSubscriberStatus(
                          subscription.id,
                          "confirmed"
                        )
                      }
                    >
                      ✅ تأكيد
                    </button>
                  )}
                  {deliveryStatus ===
                    "confirmed" && (
                    <button
                      onClick={() =>
                        updateSubscriberStatus(
                          subscription.id,
                          "preparing"
                        )
                      }
                    >
                      🍳 قيد التجهيز
                    </button>
                  )}
                  {deliveryStatus ===
                    "preparing" && (
                    <button
                      onClick={() =>
                        updateSubscriberStatus(
                          subscription.id,
                          "delivered"
                        )
                      }
                    >
                      🚚 تم التوصيل
                    </button>
                  )}
                  {deliveryStatus ===
                    "delivered" && (
                    <div className="empty">
                      ✅ تم التوصيل
                    </div>
                  )}
                </div>
              </div>
            )
          )}
          {/* ==================================================
              الطلبات اليومية العادية
          ================================================== */}
          {deliveryOrders.map(
            (order) => (
              <div
                className="delivery-card"
                key={`daily-${order.id}`}
              >
                <div className="delivery-top">
                  <div className="delivery-number">
                    #
                    {String(
                      order.id
                    ).slice(
                      0,
                      5
                    )}
                  </div>
                  <OrderStatus
                    status={
                      order.status
                    }
                  />
                </div>
                <h3>
                  {
                    order.customer_name
                  }
                </h3>
                <div className="delivery-info">
                  <p>
                    📱{" "}
                    <strong>
                      {
                        order.phone
                      }
                    </strong>
                  </p>
                  <p>
                    📍{" "}
                    <strong>
                      {
                        order.address ||
                        "-"
                      }
                    </strong>
                  </p>
                  <p>
                    🍲{" "}
                    <strong>
                      {
                        order.meal_name
                      }
                    </strong>
                  </p>
                  <p>
                    🔢{" "}
                    <strong>
                      {
                        order.quantity
                      }{" "}
                      وجبة
                    </strong>
                  </p>
                  <p>
                    💰{" "}
                    <strong>
                      {
                        order.total_price ||
                        0
                      }{" "}
                      د.أ
                    </strong>
                  </p>
                </div>
                <div className="delivery-actions">
                  {order.status ===
                    "pending" && (
                    <button
                      onClick={() =>
                        onUpdate(
                          order.id,
                          "confirmed"
                        )
                      }
                      disabled={
                        updating ===
                        order.id
                      }
                    >
                      ✅ تأكيد
                    </button>
                  )}
                  {order.status ===
                    "confirmed" && (
                    <button
                      onClick={() =>
                        onUpdate(
                          order.id,
                          "preparing"
                        )
                      }
                      disabled={
                        updating ===
                        order.id
                      }
                    >
                      🍳 قيد التجهيز
                    </button>
                  )}
                  {order.status ===
                    "preparing" && (
                    <button
                      onClick={() =>
                        onUpdate(
                          order.id,
                          "delivered"
                        )
                      }
                      disabled={
                        updating ===
                        order.id
                      }
                    >
                      🚚 تم التوصيل
                    </button>
                  )}
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
  return (
    <div className="plan">
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
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  customerAddress,
  setCustomerAddress,
  isSaving,
  onSave,
  onClose,
}) {
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
          تأكيد الاشتراك
        </h2>
        <div className="selected">
          <h3>
            اشتراك{" "}
            {
              selectedPlan.days
            }{" "}
            يوم
          </h3>
          <p>
            {
              selectedPlan.meals
            }{" "}
            وجبة يومياً
          </p>
          <strong>
            {
              selectedPlan.price
            }{" "}
            د.أ
          </strong>
          <small>
            🚚 التوصيل شامل
          </small>
        </div>
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
          placeholder="عنوان التوصيل"
          value={
            customerAddress
          }
          onChange={(e) =>
            setCustomerAddress(
              e.target.value
            )
          }
        />
        <button
          className="confirm"
          onClick={onSave}
          disabled={
            isSaving
          }
        >
          {isSaving
            ? "جاري التسجيل..."
            : "تأكيد الاشتراك"}
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
export default App
