
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

function App() {
  const [page, setPage] = useState("home")
  const [adminPage, setAdminPage] = useState("overview")

  const [selectedPlan, setSelectedPlan] = useState(null)
  const [editingSubscription, setEditingSubscription] =
    useState(null)

  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerAddress, setCustomerAddress] = useState("")

  const [isSaving, setIsSaving] = useState(false)
  const [dailyOrderOpen, setDailyOrderOpen] = useState(false)
  const [dailyQuantity, setDailyQuantity] = useState(1)
  const [dailySaving, setDailySaving] = useState(false)

  const [ordersClosed, setOrdersClosed] = useState(false)

  const [dashboard, setDashboard] = useState({
    subscriberMeals: 0,
    dailyMeals: 0,
    totalMeals: 0,
  })

  const [subscriptions, setSubscriptions] = useState([])
  const [dailyOrders, setDailyOrders] = useState([])

  const [loadingDashboard, setLoadingDashboard] = useState(false)
  const [updatingOrder, setUpdatingOrder] = useState(null)
  const [updatingSubscription, setUpdatingSubscription] =
    useState(null)

  /* ======================================================
     CLOSING TIME
  ====================================================== */

  const checkClosingTime = () => {
    const now = new Date()

    const currentMinutes =
      now.getHours() * 60 + now.getMinutes()

    setOrdersClosed(currentMinutes >= 16 * 60)
  }

  /* ======================================================
     LOAD DASHBOARD
  ====================================================== */

  const loadDashboard = async () => {
    setLoadingDashboard(true)

    try {
      const today = getToday()

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
        console.error(subscriptionsError)
      }

      const loadedSubscriptions = subscriptionsData || []

      setSubscriptions(loadedSubscriptions)

      const subscriberMeals = loadedSubscriptions
        .filter((subscription) => {
          return (
            subscription.status === "active" &&
            subscription.start_date &&
            subscription.end_date &&
            today >= subscription.start_date &&
            today <= subscription.end_date
          )
        })
        .reduce((total, subscription) => {
          return (
            total +
            Number(subscription.meals_per_day || 0)
          )
        }, 0)

      const {
        data: ordersData,
        error: ordersError,
      } = await supabase
        .from("daily_orders")
        .select("*")
        .eq("order_date", today)
        .order("created_at", {
          ascending: false,
        })

      if (ordersError) {
        console.error(ordersError)
      }

      const loadedOrders = ordersData || []

      setDailyOrders(loadedOrders)

      const dailyMeals = loadedOrders
        .filter(
          (order) =>
            order.status !== "cancelled"
        )
        .reduce((total, order) => {
          return (
            total +
            Number(order.quantity || 0)
          )
        }, 0)

      setDashboard({
        subscriberMeals,
        dailyMeals,
        totalMeals: subscriberMeals + dailyMeals,
      })
    } catch (error) {
      console.error(error)
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

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (page === "admin") {
      loadDashboard()
    }
  }, [page])

  /* ======================================================
     SAVE SUBSCRIPTION
  ====================================================== */

  const saveSubscription = async () => {
    if (!selectedPlan) return

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

      const startDate = new Date()
      const endDate = new Date(startDate)

      endDate.setDate(
        endDate.getDate() +
          selectedPlan.days -
          1
      )

      const formatDate = (date) =>
        `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}-${String(
          date.getDate()
        ).padStart(2, "0")}`

      const start = formatDate(startDate)
      const end = formatDate(endDate)

      const totalMeals =
        selectedPlan.days *
        selectedPlan.meals

      const { error } = await supabase
        .from("subscriptions")
        .insert({
          customer_id: null,

          plan_id: selectedPlan.id,

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

          start_date: start,

          end_date: end,

          total_meals:
            totalMeals,

          used_meals: 0,

          remaining_meals:
            totalMeals,

          status: "active",

          latitude:
            location.latitude,

          longitude:
            location.longitude,
        })

      if (error) {
        console.error(error)

        alert(
          "حدث خطأ أثناء التسجيل:\n" +
            error.message
        )

        return
      }

      alert(
        "تم تسجيل الاشتراك بنجاح ❤️"
      )

      setCustomerName("")
      setCustomerPhone("")
      setCustomerAddress("")
      setSelectedPlan(null)

      await loadDashboard()
    } catch (error) {
      console.error(error)

      alert(
        "حدث خطأ أثناء تسجيل الاشتراك"
      )
    } finally {
      setIsSaving(false)
    }
  }

  /* ======================================================
     DAILY ORDER
  ====================================================== */

  const openDailyOrder = () => {
    checkClosingTime()

    const now = new Date()

    const currentMinutes =
      now.getHours() * 60 +
      now.getMinutes()

    if (currentMinutes >= 16 * 60) {
      setOrdersClosed(true)

      alert(
        "الطلبات اليومية مغلقة بعد الساعة 4:00 عصراً."
      )

      return
    }

    setDailyQuantity(1)
    setDailyOrderOpen(true)
  }

  const saveDailyOrder = async () => {
    const now = new Date()

    const currentMinutes =
      now.getHours() * 60 +
      now.getMinutes()

    if (currentMinutes >= 16 * 60) {
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

    const quantity = Number(dailyQuantity)

    if (!quantity || quantity < 1) {
      alert(
        "يرجى اختيار عدد الوجبات"
      )

      return
    }

    setDailySaving(true)

    try {
      const location =
        await getCustomerLocation()

      const today = getToday()

      const { error } =
        await supabase
          .from("daily_orders")
          .insert({
            customer_name:
              customerName.trim(),

            phone:
              customerPhone.trim(),

            address:
              customerAddress.trim(),

            meal_name:
              "وجبة اليوم",

            quantity,

            order_date:
              today,

            delivery_price:
              0,

            total_price:
              DAILY_PRICE * quantity,

            status:
              "pending",

            latitude:
              location.latitude,

            longitude:
              location.longitude,
          })

      if (error) {
        console.error(error)

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

  const updateDailyOrderStatus = async (
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
        alert("حالة الطلب غير صحيحة")
        return
      }

      const { error } = await supabase
        .from("daily_orders")
        .update({
          status: newStatus,
        })
        .eq("id", orderId)

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

  const openEditSubscription = (
    subscription
  ) => {
    setEditingSubscription(subscription)
  }

  const updateSubscription = async (
    form
  ) => {
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
        Number(form.plan_days) *
        Number(form.meals_per_day)

      const usedMeals = Number(
        editingSubscription.used_meals || 0
      )

      const remainingMeals = Math.max(
        0,
        totalMeals - usedMeals
      )

      const { error } = await supabase
        .from("subscriptions")
        .update({
          customer_name:
            form.customer_name.trim(),

          phone:
            form.phone.trim(),

          address:
            form.address.trim(),

          plan_days:
            Number(form.plan_days),

          meals_per_day:
            Number(form.meals_per_day),

          price:
            Number(form.price),

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

      setEditingSubscription(null)

      await loadDashboard()
    } catch (error) {
      console.error(error)

      alert(
        "حدث خطأ في الاتصال بقاعدة البيانات"
      )
    } finally {
      setUpdatingSubscription(null)
    }
  }

  /* ======================================================
     TOGGLE SUBSCRIPTION
  ====================================================== */

  const toggleSubscription = async (
    subscription
  ) => {
    const newStatus =
      subscription.status === "active"
        ? "paused"
        : "active"

    setUpdatingSubscription(
      subscription.id
    )

    try {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          status: newStatus,
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
      setUpdatingSubscription(null)
    }
  }

  const activeSubscriptions =
    subscriptions.filter(
      (item) =>
        item.status === "active"
    )

  return (
    <div className="app" dir="rtl">

      <Header
        page={page}
        setPage={setPage}
      />

      {page === "home" && (
        <HomePage
          onSubscriptions={() =>
            setPage("subscriptions")
          }
          onDaily={() =>
            setPage("daily")
          }
        />
      )}

      {page === "subscriptions" && (
        <SubscriptionsPage
          plans={plans}
          onSelect={setSelectedPlan}
        />
      )}

      {page === "daily" && (
        <DailyPage
          ordersClosed={ordersClosed}
          onOrder={openDailyOrder}
        />
      )}

      {page === "admin" && (
        <AdminPage
          dashboard={dashboard}
          subscriptions={subscriptions}
          activeSubscriptions={
            activeSubscriptions
          }
          dailyOrders={dailyOrders}
          loading={loadingDashboard}
          onRefresh={loadDashboard}
          adminPage={adminPage}
          setAdminPage={setAdminPage}
          onUpdateOrderStatus={
            updateDailyOrderStatus
          }
          updatingOrder={updatingOrder}
          onEditSubscription={
            openEditSubscription
          }
          onToggleSubscription={
            toggleSubscription
          }
          updatingSubscription={
            updatingSubscription
          }
        />
      )}

      {selectedPlan && (
        <SubscriptionPopup
          selectedPlan={selectedPlan}
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerPhone={customerPhone}
          setCustomerPhone={setCustomerPhone}
          customerAddress={customerAddress}
          setCustomerAddress={
            setCustomerAddress
          }
          isSaving={isSaving}
          onSave={saveSubscription}
          onClose={() =>
            setSelectedPlan(null)
          }
        />
      )}

      {dailyOrderOpen && (
        <DailyOrderPopup
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerPhone={customerPhone}
          setCustomerPhone={setCustomerPhone}
          customerAddress={customerAddress}
          setCustomerAddress={
            setCustomerAddress
          }
          dailyQuantity={dailyQuantity}
          setDailyQuantity={
            setDailyQuantity
          }
          dailySaving={dailySaving}
          onSave={saveDailyOrder}
          onClose={() =>
            setDailyOrderOpen(false)
          }
        />
      )}

      {editingSubscription && (
        <EditSubscriptionPopup
          subscription={
            editingSubscription
          }
          saving={
            updatingSubscription ===
            editingSubscription.id
          }
          onSave={updateSubscription}
          onClose={() =>
            setEditingSubscription(null)
          }
        />
      )}

      <footer>
        <h2>مطبخ شيف نور</h2>
        <p>Chef Noor Cuisine</p>
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

function Header({
  page,
  setPage,
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
            onClick={onSubscriptions}
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
          جميع أسعار الاشتراكات تشمل
          التوصيل.
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
              onSelect={onSelect}
            />
          ))}

      </div>

    </div>
  )
}

/* ======================================================
   DAILY
====================================================== */

function DailyPage({
  ordersClosed,
  onOrder,
}) {
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
          سعر الوجبة{" "}
          <strong>
            3 دنانير
          </strong>
          {" "}
          — التوصيل غير شامل.
        </p>

      </div>

      <div className="daily-card">

        <div className="daily-icon">
          🍲
        </div>

        <h3>
          وجبة اليوم
        </h3>

        <p>
          وجبة بيتية طازجة
          ومحضّرة بعناية.
        </p>

        <strong className="daily-price">
          3.00 د.أ
        </strong>

        <p>
          🚚 التوصيل غير شامل
        </p>

        <button
          onClick={onOrder}
          disabled={ordersClosed}
        >
          {ordersClosed
            ? "🔴 انتهى وقت الطلب"
            : "اطلب وجبة اليوم"}
        </button>

      </div>

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

/* ======================================================
   ADMIN
====================================================== */

function AdminPage({
  dashboard,
  subscriptions,
  activeSubscriptions,
  dailyOrders,
  loading,
  onRefresh,
  adminPage,
  setAdminPage,
  onUpdateOrderStatus,
  updatingOrder,
  onEditSubscription,
  onToggleSubscription,
  updatingSubscription,
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
            إدارة المشتركين والطلبات
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
          <small>
            الرئيسية
          </small>
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
          <small>
            المشتركين
          </small>
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
          <small>
            المطبخ
          </small>
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
          <small>
            التوصيل
          </small>
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
          <small>
            الطلبات
          </small>
        </button>

      </div>

      {adminPage === "overview" && (
        <AdminOverview
          dashboard={dashboard}
          activeSubscriptions={
            activeSubscriptions
          }
          dailyOrders={dailyOrders}
        />
      )}

      {adminPage === "customers" && (
        <CustomersScreen
          subscriptions={subscriptions}
          loading={loading}
          onEdit={onEditSubscription}
          onToggle={onToggleSubscription}
          updating={updatingSubscription}
        />
      )}

      {adminPage === "kitchen" && (
        <KitchenScreen
          dashboard={dashboard}
          activeSubscriptions={
            activeSubscriptions
          }
          dailyOrders={dailyOrders}
        />
      )}

      {adminPage === "delivery" && (
        <DeliveryScreen
          dailyOrders={dailyOrders}
          onUpdate={onUpdateOrderStatus}
          updating={updatingOrder}
        />
      )}

      {adminPage === "orders" && (
        <OrdersScreen
          dailyOrders={dailyOrders}
          onUpdate={onUpdateOrderStatus}
          updating={updatingOrder}
        />
      )}

    </section>
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
            {dashboard.totalMeals}
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
            طلب قيد التجهيز / التوصيل
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
      ) : subscriptions.length === 0 ? (
        <div className="empty">
          لا يوجد مشتركون حتى الآن.
        </div>
      ) : (
        <div className="customers-grid">

          {subscriptions.map(
            (subscription) => {

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
                  total - used
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
                      {subscription.customer_name
                        ?.charAt(0) ||
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
                            total > 0
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
}) {
  return (
    <div className="screen">

      <ScreenHeader
        icon="🍳"
        title="شاشة المطبخ"
        subtitle="كل ما يحتاجه فريق الطبخ اليوم"
      />

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

      <div className="kitchen-stats">

        <div>
          <span>👥</span>

          <small>
            وجبات المشتركين
          </small>

          <strong>
            {
              dashboard.subscriberMeals
            }
          </strong>
        </div>

        <div>
          <span>🛍️</span>

          <small>
            الطلبات اليومية
          </small>

          <strong>
            {
              dashboard.dailyMeals
            }
          </strong>
        </div>

        <div>
          <span>👨‍🍳</span>

          <small>
            المشتركين
          </small>

          <strong>
            {
              activeSubscriptions.length
            }
          </strong>
        </div>

        <div>
          <span>🚚</span>

          <small>
            طلبات التوصيل
          </small>

          <strong>
            {
              dailyOrders.filter(
                (o) =>
                  o.status !==
                    "cancelled" &&
                  o.status !==
                    "delivered"
              ).length
            }
          </strong>
        </div>

      </div>

      <div className="kitchen-list">

        <div className="modern-box">

          <div className="box-title">

            <div>
              <span>🥘</span>

              <h3>
                وجبات المشتركين
              </h3>
            </div>

          </div>

          <div className="kitchen-total-row">

            <span>
              إجمالي الوجبات
            </span>

            <strong>
              {
                dashboard.subscriberMeals
              }
            </strong>

          </div>

          <p className="muted">
            يتم تجهيز الوجبات حسب
            عدد الوجبات اليومية
            للمشتركين الفعالين.
          </p>

        </div>

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
                      {
                        order.customer_name
                      }
                    </strong>

                    <span>
                      {order.quantity}{" "}
                      وجبة
                    </span>

                  </div>

                  <OrderStatus
                    status={
                      order.status
                    }
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
  onUpdate,
  updating,
}) {
  const deliveryOrders =
    dailyOrders.filter(
      (order) =>
        order.status !== "cancelled" &&
        order.status !== "delivered"
    )

  return (
    <div className="screen">

      <ScreenHeader
        icon="🚚"
        title="شاشة التوصيل"
        subtitle="متابعة الطلبات المطلوب توصيلها اليوم"
        count={
          deliveryOrders.length
        }
      />

      {deliveryOrders.length === 0 ? (
        <div className="empty modern-empty">

          <div>
            🚚
          </div>

          لا توجد طلبات جاهزة للتوصيل.

        </div>
      ) : (
        <div className="delivery-grid">

          {deliveryOrders.map(
            (order) => (

              <div
                className="delivery-card"
                key={order.id}
              >

                <div className="delivery-top">

                  <div className="delivery-number">
                    #{String(
                      order.id
                    ).slice(0, 5)}
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
                      {order.phone}
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

      {dailyOrders.length === 0 ? (
        <div className="empty modern-empty">

          <div>
            🛍️
          </div>

          لا توجد طلبات يومية اليوم.

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
                      📱 {order.phone}
                    </p>

                    <p>
                      📍{" "}
                      {
                        order.address ||
                        "-"
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
                    order={order}
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

        <h2>{title}</h2>

        <p>{subtitle}</p>

      </div>

      {count !== undefined && (
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
    pending: "🟡 قيد الانتظار",
    confirmed: "🔵 مؤكد",
    preparing: "👨‍🍳 قيد التجهيز",
    delivered: "🚚 تم التوصيل",
    cancelled: "❌ ملغي",
  }

  return (
    <span className="order-status">
      {statuses[status] || status}
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
    order.status === "pending"
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
    order.status === "confirmed"
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
    order.status === "preparing"
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
    order.status === "delivered"
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
          {" "}د.أ
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
            {selectedPlan.days} يوم
          </h3>

          <p>
            {selectedPlan.meals}{" "}
            وجبة يومياً
          </p>

          <strong>
            {selectedPlan.price} د.أ
          </strong>

          <small>
            🚚 التوصيل شامل
          </small>

        </div>

        <input
          type="text"
          placeholder="الاسم الكامل"
          value={customerName}
          onChange={(e) =>
            setCustomerName(
              e.target.value
            )
          }
        />

        <input
          type="tel"
          placeholder="رقم الهاتف"
          value={customerPhone}
          onChange={(e) =>
            setCustomerPhone(
              e.target.value
            )
          }
        />

        <textarea
          placeholder="عنوان التوصيل"
          value={customerAddress}
          onChange={(e) =>
            setCustomerAddress(
              e.target.value
            )
          }
        />

        <button
          className="confirm"
          onClick={onSave}
          disabled={isSaving}
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
   DAILY ORDER POPUP
====================================================== */

function DailyOrderPopup({
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

        <div className="selected">

          <h3>
            وجبة اليوم
          </h3>

          <strong>
            3.00 د.أ
          </strong>

          <small>
            🚚 التوصيل غير شامل
          </small>

        </div>

        <input
          type="text"
          placeholder="الاسم الكامل"
          value={customerName}
          onChange={(e) =>
            setCustomerName(
              e.target.value
            )
          }
        />

        <input
          type="tel"
          placeholder="رقم الهاتف"
          value={customerPhone}
          onChange={(e) =>
            setCustomerPhone(
              e.target.value
            )
          }
        />

        <textarea
          placeholder="عنوان التوصيل"
          value={customerAddress}
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
          value={dailyQuantity}
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
            {DAILY_PRICE *
              dailyQuantity}{" "}
            د.أ
          </strong>

        </div>

        <button
          className="confirm"
          onClick={onSave}
          disabled={dailySaving}
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
        subscription.phone || "",

      address:
        subscription.address || "",

      plan_days:
        subscription.plan_days || 26,

      meals_per_day:
        subscription.meals_per_day ||
        1,

      price:
        subscription.price || 0,

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
          value={form.customer_name}
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
          value={form.phone}
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
          value={form.address}
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
              value={form.plan_days}
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
          value={form.price}
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
          value={form.status}
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

