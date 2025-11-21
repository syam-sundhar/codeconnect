const renderedPosts = new Set();

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  getDoc,
  where,
  arrayUnion,
  initializeFirestore,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDejh5-fbyyAlWmD8t1qeDuPpKkhHorTl4",
  authDomain: "codeconnect-f6bab.firebaseapp.com",
  projectId: "codeconnect-f6bab",
  storageBucket: "codeconnect-f6bab.appspot.com",
  messagingSenderId: "406795026329",
  appId: "1:406795026329:web:ed828e51bac75c17ee9d08",
  measurementId: "G-HCXN6VTP12"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = initializeFirestore(app, {
  localCache: persistentMultipleTabManager()
});

// Function to check if a user is admin
async function checkAdminStatus(email) {
  const adminRef = doc(db, "admins", email);
  const adminSnap = await getDoc(adminRef);
  return adminSnap.exists() && adminSnap.data().isAdmin === true;
}

// Toggle code textarea visibility
function toggleCodeBox() {
  const titleEl = document.getElementById("unitTitle");
  const codeBox = document.getElementById("code");
  if (!titleEl || !codeBox) return;

  const unitName = titleEl.textContent.trim().toLowerCase();
  if (unitName === "queries") {
    codeBox.style.display = "none";
  } else {
    codeBox.style.display = "block";
  }
}

// Elements
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");
const unitsDiv = document.getElementById("units");
const postsDiv = document.getElementById("posts");
const addUnitBtn = document.getElementById("addUnitBtn");
const postBtn = document.getElementById("postBtn");
const qField = document.getElementById("question");
const cField = document.getElementById("code");
const unitTitle = document.getElementById("unitTitle");
const searchInput = document.getElementById("searchInput");

let currentUser = null;
let currentUnit = null;

// Auth
loginBtn.onclick = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
  } catch (err) {
    alert(err.message);
  }
};

logoutBtn.onclick = async () => await signOut(auth);

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const firstLetter = user.displayName
      ? user.displayName.charAt(0).toUpperCase()
      : "?";

    const isAdmin = await checkAdminStatus(user.email);

    userInfo.innerHTML = `
      <div class="user-profile">
        <div class="user-logo">${firstLetter}</div>
        <div>
          <b>${user.displayName}</b><br>
          <small>${user.email}</small><br>
          ${isAdmin ? "<span style='color:#10b981;font-weight:bold;'>Admin</span>" : ""}
        </div>
      </div>
    `;

    loginBtn.style.display = "none";
    logoutBtn.style.display = "block";
    loadUnits();
    toggleCodeBox();
    addUnitBtn.style.display = isAdmin ? "block" : "none";
  } else {
    currentUser = null;
    userInfo.innerHTML = "";
    loginBtn.style.display = "block";
    logoutBtn.style.display = "none";
    postsDiv.innerHTML = "";
    addUnitBtn.style.display = "none";
  }
});

// Load Units
async function loadUnits() {
  const snap = await getDocs(collection(db, "units"));
  unitsDiv.innerHTML = "";
  snap.forEach(docu => {
    const u = docu.data();
    const div = document.createElement("div");
    div.className = "unit";
    div.textContent = u.name;
    div.onclick = (event) => selectUnit(docu.id, u.name, event);
    unitsDiv.appendChild(div);
  });
}

// Select Unit
function selectUnit(id, name, event) {
  currentUnit = { id, name };
  document.querySelectorAll(".unit").forEach(u => u.classList.remove("active"));
  const clicked = event && event.target ? event.target.closest(".unit") : null;
  if (clicked) clicked.classList.add("active");
  unitTitle.textContent = name;
  postsDiv.innerHTML = "";
  renderedPosts.clear();
  toggleCodeBox();
  listenPosts();
}

// Render Post
async function renderPost(id, p) {
  if (renderedPosts.has(id)) return;
  renderedPosts.add(id);

  const card = document.createElement("div");
  card.className = "post-card";
  card.id = `post-${id}`;

  let avgRating = "0.0";
  if (!id.startsWith("temp-")) {
    const docSnap = await getDoc(doc(db, "posts", id));
    const data = docSnap.exists() ? docSnap.data() : {};
    const ratings = data.ratings || [];
    avgRating = ratings.length
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : "0.0";
  }

  const codeSection = p.code ? `
    <div class="code-block">
      <pre id="code-${id}">${p.code}</pre>
      <button class="copy-btn" onclick="copyCode('${id}')">📋 Copy</button>
    </div>
  ` : '';

  const commentsCount = (p.comments || []).length;

  card.innerHTML = `
    <h3>${p.question}</h3>
    ${codeSection}
    <div><small>by ${p.userName || "Anonymous"} • ${new Date(p.ts).toLocaleString()}</small></div>

    <div class="rating" id="rating-${id}">
      ${[1, 2, 3, 4, 5].map(n => 
        `<span data-star="${n}" class="${n <= Math.round(avgRating) ? 'filled' : ''}">⭐</span>`
      ).join("")}
      <small id="avg-${id}">(${avgRating})</small>
    </div>

    <div class="comments-section">
      <button class="comments-toggle" onclick="toggleComments('${id}')">
        💬 ${commentsCount > 0 ? `${commentsCount} Comments` : 'Add Comment'}
      </button>
      <div class="comments-list" id="comments-${id}">
        <div id="comments-container-${id}">
          ${(p.comments || []).map(c => 
            `<div class="comment"><b>${c.user}</b>: ${c.text}</div>`
          ).join("")}
        </div>
        <div class="comment-input-section">
          <input id="comment-input-${id}" placeholder="Add a comment...">
          <button onclick="addComment('${id}')">Send</button>
        </div>
      </div>
    </div>
  `;

  postsDiv.appendChild(card);

  // Handle Rating
  if (!id.startsWith("temp-")) {
    card.querySelectorAll(`#rating-${id} span`).forEach((star) => {
      star.onclick = async (e) => {
        if (!currentUser) return alert("Login first");
        const rating = parseInt(e.target.dataset.star);

        const userEmail = currentUser.email;
        const docRef = doc(db, "posts", id);
        const postSnap = await getDoc(docRef);
        const postData = postSnap.data();

        const userRatings = postData.userRatings || {};
        if (userRatings[userEmail]) {
          alert("You've already rated this post!");
          return;
        }

        userRatings[userEmail] = rating;
        const allRatings = Object.values(userRatings);
        const newAvg = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;

        await updateDoc(docRef, {
          ratings: allRatings,
          userRatings,
        });

        // Update UI
        card.querySelector(`#avg-${id}`).innerText = `(${newAvg.toFixed(1)})`;
        card.querySelectorAll(`#rating-${id} span`).forEach((s, i) => {
          s.classList.toggle('filled', i < rating);
        });
      };
    });
  }
}

// Global functions for inline onclick
window.copyCode = function(postId) {
  const codeElement = document.getElementById(`code-${postId}`);
  const text = codeElement.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = codeElement.nextElementSibling;
    const originalText = btn.textContent;
    btn.textContent = "✓ Copied!";
    setTimeout(() => btn.textContent = originalText, 2000);
  });
};

window.toggleComments = function(postId) {
  const commentsList = document.getElementById(`comments-${postId}`);
  commentsList.classList.toggle('visible');
};

window.addComment = async function(postId) {
  if (!currentUser) return alert("Login first");
  const input = document.getElementById(`comment-input-${postId}`);
  const text = input.value.trim();
  if (!text) return;

  const newComment = {
    user: currentUser.displayName,
    text: text,
    ts: Date.now()
  };

  await updateDoc(doc(db, "posts", postId), {
    comments: arrayUnion(newComment)
  });

  input.value = "";
};

// Listen for posts
function listenPosts() {
  if (!currentUnit) return;

  postsDiv.innerHTML = "";
  renderedPosts.clear();

  const q = query(
    collection(db, "posts"),
    where("unitId", "==", currentUnit.id),
    orderBy("ts", "asc")
  );

  onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const docData = change.doc.data();
      const docId = change.doc.id;

      if (docData.isTemp) return;

      if (change.type === "added") {
        renderPost(docId, docData);
        postsDiv.scrollTop = postsDiv.scrollHeight;
      }
    });
  });
}

// Add Unit - FIXED
addUnitBtn.onclick = async () => {
  if (!currentUser) return alert("Login first");

  const isAdmin = await checkAdminStatus(currentUser.email);
  if (!isAdmin) return alert("Only admins can add units");

  const name = prompt("Enter new unit name:");
  if (!name || name.trim() === "") return;

  try {
    await addDoc(collection(db, "units"), { name: name.trim() });
    alert("Unit added successfully!");
    loadUnits();
  } catch (error) {
    alert("Error adding unit: " + error.message);
    console.error("Error adding unit:", error);
  }
};

// Post Question
postBtn.onclick = async () => {
  if (!currentUser) return alert("Login first");
  if (!currentUnit) return alert("Select a unit first");

  const q = qField.value.trim();
  const c = cField.value.trim();
  if (!q && !c) return alert("Enter a question or code");

  const isAdmin = await checkAdminStatus(currentUser.email);

  if (currentUnit.name.toLowerCase().includes("mentor") && !isAdmin) {
    alert("Only admins can send messages in this unit.");
    return;
  }

  if (currentUnit.name.toLowerCase().includes("queries") && c) {
    alert("You can only post questions in this unit – code not allowed.");
    return;
  }

  const newPost = {
    question: q,
    code: c,
    userName: currentUser.displayName,
    userEmail: currentUser.email,
    unitId: currentUnit.id,
    ts: Date.now(),
    comments: [],
    ratings: [],
  };

  const tempId = "temp-" + Date.now();
  renderPost(tempId, newPost);
  postsDiv.scrollTop = postsDiv.scrollHeight;

  try {
    await addDoc(collection(db, "posts"), newPost);
    const tempCard = document.getElementById(`post-${tempId}`);
    if (tempCard) tempCard.remove();
    renderedPosts.delete(tempId);
  } catch (err) {
    alert("Error posting: " + err.message);
  }

  qField.value = "";
  cField.value = "";
};

// Search
let isSearching = false;

searchInput.oninput = async () => {
  const text = searchInput.value.toLowerCase().trim();

  if (!currentUnit) {
    alert("Select a unit first");
    return;
  }

  if (text === "") {
    isSearching = false;
    postsDiv.innerHTML = "";
    renderedPosts.clear();
    listenPosts();
    return;
  }

  isSearching = true;
  postsDiv.innerHTML = "";
  renderedPosts.clear();

  const qSnap = await getDocs(
    query(
      collection(db, "posts"),
      where("unitId", "==", currentUnit.id),
      orderBy("ts", "asc")
    )
  );

  const results = [];
  qSnap.forEach((docu) => {
    const p = docu.data();
    if (
      (p.question && p.question.toLowerCase().includes(text)) ||
      (p.userName && p.userName.toLowerCase().includes(text))
    ) {
      results.push({ id: docu.id, ...p });
    }
  });

  results.sort((a, b) => {
    const avgA = a.userRatings
      ? Object.values(a.userRatings).reduce((p, c) => p + c, 0) / Object.values(a.userRatings).length
      : 0;
    const avgB = b.userRatings
      ? Object.values(b.userRatings).reduce((p, c) => p + c, 0) / Object.values(b.userRatings).length
      : 0;
    return avgB - avgA;
  });

  if (results.length === 0) {
    postsDiv.innerHTML = "<p style='text-align:center;color:gray;'>No matching results found.</p>";
    return;
  }

  for (const p of results) {
    await renderPost(p.id, p);
  }
};