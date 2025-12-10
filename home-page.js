// home-page.js

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
  doc,
  onSnapshot,
  query,
  orderBy,
  initializeFirestore,
  persistentMultipleTabManager,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Hide loading screen when page is fully loaded
window.addEventListener('load', () => {
  setTimeout(() => {
    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen.classList.add('hidden');
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 500);
  }, 1000);
});

// Firebase Config (same as your existing app)
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

// when user selects a group:
function openGroup(groupId) {
  // store the selected group id (if you're already doing this, keep it)
  localStorage.setItem("selectedGroupId", groupId);

  // now go to chat room page
  window.location.href = "chatroom.html";
}

// Check if user is admin
function checkAdminStatus(email) {
  const adminEmails = [
    "syamsksanand@gmail.com",
    "localtemples25@gmail.com"
  ];
  return adminEmails.includes(email);
}

// Elements
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");
const adminSection = document.getElementById("adminSection");
const createGroupBtn = document.getElementById("createGroupBtn");
const groupsContainer = document.getElementById("groupsContainer");
const modal = document.getElementById("createGroupModal");
const closeModal = document.querySelector(".close");
const createGroupForm = document.getElementById("createGroupForm");

let currentUser = null;

// Authentication
loginBtn.onclick = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
  } catch (err) {
    alert("Login failed: " + err.message);
  }
};

logoutBtn.onclick = async () => {
  await signOut(auth);
};

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    const firstLetter = user.displayName
      ? user.displayName.charAt(0).toUpperCase()
      : "?";

    const isAdmin = checkAdminStatus(user.email);

    userInfo.innerHTML = `
      <div class="user-profile">
        <div class="user-logo">${firstLetter}</div>
        <div>
          <b>${user.displayName}</b><br>
          <small>${user.email}</small>
          ${isAdmin ? "<br><span style='color:#10b981;font-weight:bold;'>Admin</span>" : ""}
        </div>
      </div>
    `;

    loginBtn.style.display = "none";
    logoutBtn.style.display = "block";

    // Show admin section if admin
    if (isAdmin) {
      adminSection.style.display = "block";
    }

    // Load groups
    loadGroups();
  } else {
    currentUser = null;
    userInfo.innerHTML = "";
    loginBtn.style.display = "block";
    logoutBtn.style.display = "none";
    adminSection.style.display = "none";
    loadGroups(); // Still show groups for non-logged in users
  }
});

// Load Groups
async function loadGroups() {
  const q = query(collection(db, "groups"), orderBy("createdAt", "desc"));
  
  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      groupsContainer.innerHTML = `
        <div class="no-groups-message">
          <p>No groups available yet. ${currentUser && checkAdminStatus(currentUser.email) ? 'Create one to get started!' : 'Check back soon!'}</p>
        </div>
      `;
      return;
    }

    groupsContainer.innerHTML = "";
    snapshot.forEach((doc) => {
      const group = doc.data();
      renderGroupCard(doc.id, group);
    });
  });
}

// Render Group Card
function renderGroupCard(groupId, group) {
  const card = document.createElement("div");
  card.className = "group-card";
  card.setAttribute("data-color", group.color || "indigo");

  const memberCount = group.memberCount || 0;
  const createdDate = group.createdAt ? new Date(group.createdAt.toDate()).toLocaleDateString() : "Recently";

  card.innerHTML = `
    <div class="group-card-header">
      <div class="group-icon">${getGroupIcon(group.color)}</div>
      <div class="group-info">
        <h3>${group.name}</h3>
        <p>Created ${createdDate}</p>
      </div>
    </div>
    <div class="group-description">${group.description}</div>
    <div class="group-meta">
      <div class="group-stats">
        <div class="group-stat">
          <span>👥</span>
          <span>${memberCount} members</span>
        </div>
      </div>
      <button class="enter-group-btn" onclick="enterGroup('${groupId}')">Enter →</button>
    </div>
  `;

  groupsContainer.appendChild(card);
}

// Get group icon based on color
function getGroupIcon(color) {
  const icons = {
    red: '🔴',
    orange: '🟠',
    yellow: '🟡',
    green: '🟢',
    teal: '🔵',
    indigo: '🟣',
    purple: '🟣'
  };
  return icons[color] || '💬';
}

window.enterGroup = function(groupId) {
  if (!currentUser) {
    alert("Please login first to enter a group");
    return;
  }
  
  localStorage.setItem('selectedGroupId', groupId);
  window.location.href = 'chatroom.html';
};


// Create Group Modal
createGroupBtn.onclick = () => {
  modal.classList.add('show');
};

closeModal.onclick = () => {
  modal.classList.remove('show');
};

window.onclick = (event) => {
  if (event.target === modal) {
    modal.classList.remove('show');
  }
};

// Create Group Form Submit
createGroupForm.onsubmit = async (e) => {
  e.preventDefault();
  
  if (!currentUser) {
    alert("Please login first");
    return;
  }

  const isAdmin = checkAdminStatus(currentUser.email);
  if (!isAdmin) {
    alert("Only admins can create groups");
    return;
  }

  const groupName = document.getElementById("groupName").value.trim();
  const groupDescription = document.getElementById("groupDescription").value.trim();
  const groupColor = document.getElementById("groupColor").value;

  if (!groupName || !groupDescription) {
    alert("Please fill in all fields");
    return;
  }

  try {
    await addDoc(collection(db, "groups"), {
      name: groupName,
      description: groupDescription,
      color: groupColor,
      createdBy: currentUser.email,
      createdByName: currentUser.displayName,
      createdAt: serverTimestamp(),
      memberCount: 0
    });

    alert("Group created successfully!");
    modal.classList.remove('show');
    createGroupForm.reset();
  } catch (error) {
    alert("Error creating group: " + error.message);
    console.error("Error creating group:", error);
  }
};