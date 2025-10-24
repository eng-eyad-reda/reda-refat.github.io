/***********************
  script.js - محدث: دعم خريطة + تحديد موقع لكل حجز
  تأكد من وضع Google Maps API Key في index.html
************************/

// LocalStorage keys
const STORAGE_KEY = "reda_bookings_v2";
const USER_NAME_KEY = "reda_user_name";
const USER_PHONE_KEY = "reda_user_phone";

// Elements
const tabBook = document.getElementById("tab-book");
const tabDriver = document.getElementById("tab-driver");
const viewBook = document.getElementById("view-book");
const viewDriver = document.getElementById("view-driver");

const bookingForm = document.getElementById("bookingForm");
const b_name = document.getElementById("b_name");
const b_phone = document.getElementById("b_phone");
const b_from = document.getElementById("b_from");
const b_to = document.getElementById("b_to");
const b_date = document.getElementById("b_date");
const b_time = document.getElementById("b_time");
const customerBookings = document.getElementById("customerBookings");

const btnOpenLogin = document.getElementById("btnOpenLogin");
const loginPanel = document.getElementById("loginPanel");
const loginBtn = document.getElementById("loginBtn");
const driverPass = document.getElementById("driverPass");
const driverDashboard = document.getElementById("driverDashboard");
const driverList = document.getElementById("driverList");
const btnLogout = document.getElementById("btnLogout");
const btnClearAll = document.getElementById("btnClearAll");

// Driver password
const DRIVER_PASSWORD = "1234552011";

// Map variables
let map, marker, autocompleteFrom, autocompleteTo;
let selectedLatLng = null; // will hold {lat, lng} for the chosen point

// Utility load/save
function loadBookings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { console.error(e); return []; }
}
function saveBookings(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// Prefill saved name/phone
function initUserInfo() {
  const savedName = localStorage.getItem(USER_NAME_KEY);
  const savedPhone = localStorage.getItem(USER_PHONE_KEY);
  if (savedName) b_name.value = savedName;
  if (savedPhone) b_phone.value = savedPhone;
}
initUserInfo();

// Tabs
tabBook.addEventListener("click", () => {
  viewBook.classList.add("active");
  viewDriver.classList.remove("active");
  tabBook.classList.add("active");
  tabDriver.classList.remove("active");
});
tabDriver.addEventListener("click", () => {
  viewDriver.classList.add("active");
  viewBook.classList.remove("active");
  tabDriver.classList.add("active");
  tabBook.classList.remove("active");
});

// Save user name/phone on change
b_name.addEventListener("change", () => {
  const v = b_name.value.trim();
  if (v) localStorage.setItem(USER_NAME_KEY, v);
});
b_phone.addEventListener("change", () => {
  const v = b_phone.value.trim();
  if (v) localStorage.setItem(USER_PHONE_KEY, v);
});

// Booking submit (now saves location if selected)
bookingForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = b_name.value.trim();
  const phone = b_phone.value.trim() || "";
  const from = b_from.value.trim();
  const to = b_to.value.trim();
  const date = b_date.value;
  const time = b_time.value;

  if (!name || !from || !to || !date || !time) { alert("من فضلك اكمل جميع الحقول المطلوبة."); return; }

  // save name/phone for next visits
  localStorage.setItem(USER_NAME_KEY, name);
  if (phone) localStorage.setItem(USER_PHONE_KEY, phone);

  const bookings = loadBookings();
  const newBooking = {
    id: Date.now(),
    name, phone, from, to, date, time,
    price: null,
    status: "pending",
    createdAt: new Date().toISOString(),
    location: selectedLatLng // may be null if user didn't pick on map
  };
  bookings.unshift(newBooking);
  saveBookings(bookings);

  alert("✅ تم إرسال طلب الحجز. سيظهر لدى السائق في لوحة التحكم.");
  bookingForm.reset();
  initUserInfo();
  // Reset marker? keep marker as is
  renderCustomerBookings();
  renderDriverList();
});

// Render customer bookings (only for saved name)
function renderCustomerBookings() {
  customerBookings.innerHTML = "";
  const bookings = loadBookings();
  const savedName = localStorage.getItem(USER_NAME_KEY) || "";
  const myBookings = bookings.filter(b => b.name && savedName && b.name === savedName);

  if (!savedName) {
    customerBookings.innerHTML = "<p class='muted'>الاسم غير محفوظ — اكتب اسمك أعلاه ليتم حفظه تلقائيًا وتعرض الحجوزات الخاصة بك.</p>";
    return;
  }

  if (myBookings.length === 0) {
    customerBookings.innerHTML = "<p class='muted'>لا توجد حجوزات باسمك حتى الآن.</p>";
    return;
  }

  myBookings.forEach(b => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>${escapeHtml(b.from)} → ${escapeHtml(b.to)}</strong>
        <div class="booking-meta">${escapeHtml(b.date)} · ${escapeHtml(b.time)}</div>
        <div class="muted">الاسم: ${escapeHtml(b.name)} ${b.phone ? "· هاتف: " + escapeHtml(b.phone) : ""}</div>
        ${b.price ? `<div class="price">💰 السعر المحدد: <b>${escapeHtml(b.price)} جنيه</b></div>` : `<div class="muted">⏳ في انتظار رد السائق...</div>`}
        ${b.location ? `<div class="booking-meta">موقع الحجز: <a target="_blank" href="https://www.google.com/maps?q=${b.location.lat},${b.location.lng}">عرض على الخريطة</a></div>` : ""}
      </div>
    `;
    customerBookings.appendChild(li);
  });
}

// Driver login & actions
btnOpenLogin.addEventListener("click", () => {
  loginPanel.classList.toggle("hidden");
});
loginBtn.addEventListener("click", () => {
  const pass = driverPass.value.trim();
  if (pass === DRIVER_PASSWORD) {
    loginPanel.classList.add("hidden");
    driverDashboard.classList.remove("hidden");
    btnLogout.classList.remove("hidden");
    renderDriverList();
  } else {
    alert("كلمة المرور غير صحيحة.");
  }
});
btnLogout.addEventListener("click", () => {
  driverDashboard.classList.add("hidden");
  btnLogout.classList.add("hidden");
  loginPanel.classList.remove("hidden");
  driverPass.value = "";
});

// Render driver list
function renderDriverList() {
  driverList.innerHTML = "";
  const bookings = loadBookings();
  if (bookings.length === 0) {
    driverList.innerHTML = "<p class='muted'>لا توجد حجوزات حالياً.</p>";
    return;
  }
  bookings.forEach((b, idx) => {
    const li = document.createElement("li");

    const left = document.createElement("div");
    left.className = "booking-left";
    left.innerHTML = `<strong>${escapeHtml(b.name || "زائر")}</strong>
      <div class="booking-meta">${escapeHtml(b.from)} → ${escapeHtml(b.to)} · ${escapeHtml(b.date)} ${escapeHtml(b.time)}</div>
      <div class="muted">هاتف: ${escapeHtml(b.phone || "-")}</div>
      <div class="muted">الحالة: <b>${escapeHtml(b.status)}</b> ${b.price ? " · السعر: " + escapeHtml(b.price) + " ج.م" : ""}</div>
      ${b.location ? `<div class="booking-meta">إحداثيات: ${b.location.lat.toFixed(6)}, ${b.location.lng.toFixed(6)} · <a target="_blank" href="https://www.google.com/maps?q=${b.location.lat},${b.location.lng}">عرض على الخريطة</a></div>` : "<div class='muted'>لم يتم تحديد موقع على الخريطة</div>"}`;

    const actions = document.createElement("div");
    actions.className = "booking-actions";

    const priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.placeholder = "السعر (جنيه)";
    priceInput.value = b.price || "";

    const sendBtn = document.createElement("button");
    sendBtn.className = "small-btn send";
    sendBtn.textContent = "أرسل السعر";
    sendBtn.addEventListener("click", () => {
      const val = priceInput.value.trim();
      if (!val || isNaN(val) || Number(val) <= 0) { alert("أدخل سعر صحيح."); return; }
      const all = loadBookings();
      const idxInAll = all.findIndex(x => x.id === b.id);
      if (idxInAll > -1) {
        all[idxInAll].price = val;
        all[idxInAll].status = "offered";
        saveBookings(all);
        alert(`تم إرسال السعر (${val} جنيه) للعميل ${all[idxInAll].name}`);
        renderDriverList();
        renderCustomerBookings();
      }
    });

    const acceptBtn = document.createElement("button");
    acceptBtn.className = "small-btn offer";
    acceptBtn.textContent = "مقبول";
    acceptBtn.addEventListener("click", () => {
      if (!confirm("ضع هذه الرحلة كمقبول؟")) return;
      const all = loadBookings();
      const idxInAll = all.findIndex(x => x.id === b.id);
      if (idxInAll > -1) {
        all[idxInAll].status = "accepted";
        saveBookings(all);
        renderDriverList();
        renderCustomerBookings();
      }
    });

    const rejectBtn = document.createElement("button");
    rejectBtn.className = "small-btn danger";
    rejectBtn.textContent = "مرفوض";
    rejectBtn.addEventListener("click", () => {
      if (!confirm("ضع هذه الرحلة كمرفوض؟")) return;
      const all = loadBookings();
      const idxInAll = all.findIndex(x => x.id === b.id);
      if (idxInAll > -1) {
        all[idxInAll].status = "rejected";
        saveBookings(all);
        renderDriverList();
        renderCustomerBookings();
      }
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "small-btn delete";
    deleteBtn.textContent = "حذف";
    deleteBtn.addEventListener("click", () => {
      if (!confirm("حذف هذا الطلب نهائيًا؟")) return;
      let all = loadBookings();
      all = all.filter(x => x.id !== b.id);
      saveBookings(all);
      renderDriverList();
      renderCustomerBookings();
    });

    actions.appendChild(priceInput);
    actions.appendChild(sendBtn);
    actions.appendChild(acceptBtn);
    actions.appendChild(rejectBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(left);
    li.appendChild(actions);
    driverList.appendChild(li);
  });
}

// Clear all bookings
btnClearAll.addEventListener("click", () => {
  if (!confirm("حذف جميع الحجوزات من المتصفح؟")) return;
  localStorage.removeItem(STORAGE_KEY);
  renderDriverList();
  renderCustomerBookings();
});

// Escape helper
function escapeHtml(text) {
  if (!text && text !== 0) return "";
  return String(text).replace(/[&<>"']/g, function (m) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
  });
}

/* =========================
   Google Maps integration
   - initMap called automatically by API callback
   - autocomplete for 'from' and 'to'
   - click on map sets selectedLatLng and moves marker
   - dragging marker updates selectedLatLng
   ========================= */
function initMap() {
  // default center Cairo
  const defaultLoc = { lat: 30.0444, lng: 31.2357 };

  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultLoc,
    zoom: 12,
    streetViewControl: false,
  });

  marker = new google.maps.Marker({
    position: defaultLoc,
    map,
    draggable: true,
    title: "اسحب لتحديد الموقع أو اضغط على الخريطة",
  });

  // initialize selectedLatLng to null initially
  selectedLatLng = null;

  // when marker dragged, update selectedLatLng
  marker.addListener("dragend", function () {
    const pos = marker.getPosition();
    selectedLatLng = { lat: pos.lat(), lng: pos.lng() };
  });

  // click map to move marker
  map.addListener("click", function (e) {
    marker.setPosition(e.latLng);
    map.panTo(e.latLng);
    selectedLatLng = { lat: e.latLng.lat(), lng: e.latLng.lng() };
  });

  // Autocomplete for 'from' and 'to' fields
  const fromInput = document.getElementById("b_from");
  const toInput = document.getElementById("b_to");

  autocompleteFrom = new google.maps.places.Autocomplete(fromInput);
  autocompleteTo = new google.maps.places.Autocomplete(toInput);

  // when user selects place in 'to', move map & marker to that place and set selectedLatLng
  autocompleteTo.addListener("place_changed", function () {
    const place = autocompleteTo.getPlace();
    if (!place.geometry || !place.geometry.location) return;
    map.panTo(place.geometry.location);
    map.setZoom(15);
    marker.setPosition(place.geometry.location);
    selectedLatLng = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
  });

  // optional: when user selects place in 'from', move map slightly (helpful)
  autocompleteFrom.addListener("place_changed", function () {
    const place = autocompleteFrom.getPlace();
    if (!place.geometry || !place.geometry.location) return;
    map.panTo(place.geometry.location);
    map.setZoom(14);
  });
}

// ensure functions available globally for Google callback
window.initMap = initMap;

// Initial renders
renderCustomerBookings();
renderDriverList();
