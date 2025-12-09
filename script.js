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

// Hide loading screen when page is fully loaded
window.addEventListener('load', () => {
  setTimeout(() => {
    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen.classList.add('hidden');
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 500);
  }, 1500);
});

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
function checkAdminStatus(email) {
  const adminEmails = [
    "syamsksanand@gmail.com",
    "localtemples25@gmail.com"
    "reddynakodara@gmail.com"
  ];
  return adminEmails.includes(email);
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

// Save current unit selection to localStorage
function saveCurrentUnit() {
  if (currentUnit) {
    localStorage.setItem('currentUnit', JSON.stringify(currentUnit));
  }
}

// Load saved unit selection from localStorage
function loadSavedUnit() {
  const saved = localStorage.getItem('currentUnit');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return null;
    }
  }
  return null;
}

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
          <small>${user.email}</small><br>
          ${isAdmin ? "<span style='color:#10b981;font-weight:bold;'>Admin</span>" : ""}
        </div>
      </div>
    `;

    loginBtn.style.display = "none";
    logoutBtn.style.display = "block";
    
    // Load units and restore last selection
    loadUnits().then(() => {
      const savedUnit = loadSavedUnit();
      if (savedUnit) {
        restoreUnitSelection(savedUnit);
      }
    });
    
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
  
  for (const docu of snap.docs) {
    const u = docu.data();
    const unitDiv = document.createElement("div");
    
    const isMentor = u.name.toLowerCase().includes("mentor");
    
    if (isMentor) {
      unitDiv.className = "unit has-subtopics";
      unitDiv.innerHTML = `
        ${u.name}
        <span class="dropdown-icon">▼</span>
      `;
      
      const subtopicsDiv = document.createElement("div");
      subtopicsDiv.className = "subtopics";
      subtopicsDiv.id = `subtopics-${docu.id}`;
      
      const subtopicsSnap = await getDocs(collection(db, "units", docu.id, "subtopics"));
      subtopicsSnap.forEach(subDoc => {
        const subData = subDoc.data();
        const subDiv = document.createElement("div");
        subDiv.className = "subtopic";
        
        const isAdmin = currentUser && checkAdminStatus(currentUser.email);
        
        const nameSpan = document.createElement("span");
        nameSpan.className = "subtopic-name";
        nameSpan.textContent = subData.name;
        
        // FIXED: Better event handling to prevent dropdown closing
        nameSpan.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          selectSubtopic(docu.id, u.name, subDoc.id, subData.name, subDiv);
        });
        
        // Also handle clicks on the entire subtopic div
        subDiv.addEventListener('click', (e) => {
          // Only handle if clicking the subtopic itself, not buttons
          if (e.target === subDiv || e.target === nameSpan) {
            e.stopPropagation();
            e.preventDefault();
            selectSubtopic(docu.id, u.name, subDoc.id, subData.name, subDiv);
          }
        });
        
        subDiv.appendChild(nameSpan);
        
        if (isAdmin) {
          const menuBtn = document.createElement("button");
          menuBtn.className = "subtopic-menu-btn";
          menuBtn.textContent = "⋮";
          menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            toggleSubtopicMenu(docu.id, subDoc.id);
          });
          
          const menuDropdown = document.createElement("div");
          menuDropdown.className = "subtopic-menu-dropdown";
          menuDropdown.id = `subtopic-menu-${docu.id}-${subDoc.id}`;
          
          const editBtn = document.createElement("button");
          editBtn.className = "subtopic-menu-item";
          editBtn.textContent = "✏️ Edit Name";
          editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            editSubtopic(docu.id, subDoc.id, subData.name);
          });
          
          menuDropdown.appendChild(editBtn);
          subDiv.appendChild(menuBtn);
          subDiv.appendChild(menuDropdown);
        }
        
        subtopicsDiv.appendChild(subDiv);
      });
      
      if (currentUser && checkAdminStatus(currentUser.email)) {
        const addTopicBtn = document.createElement("button");
        addTopicBtn.className = "add-topic-btn";
        addTopicBtn.textContent = "+ Add Topic";
        addTopicBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          addSubtopic(docu.id);
        });
        subtopicsDiv.appendChild(addTopicBtn);
      }
      
      unitDiv.appendChild(subtopicsDiv);
      
      // FIXED: Only toggle when clicking the unit header itself, not children
      unitDiv.addEventListener('click', (event) => {
        // Check if click is on subtopics container or its children
        if (event.target.closest('.subtopics')) {
          return; // Don't toggle if clicking inside subtopics area
        }
        // Only toggle if clicking the unit div or dropdown icon
        if (event.target === unitDiv || event.target.classList.contains('dropdown-icon')) {
          toggleSubtopics(docu.id);
        }
      });
    } else {
      unitDiv.className = "unit";
      unitDiv.textContent = u.name;
      unitDiv.addEventListener('click', (event) => selectUnit(docu.id, u.name, event));
    }
    
    unitsDiv.appendChild(unitDiv);
  }
}

// Toggle subtopics dropdown
function toggleSubtopics(unitId) {
  const subtopicsDiv = document.getElementById(`subtopics-${unitId}`);
  const parentUnit = subtopicsDiv.parentElement;
  const icon = parentUnit.querySelector('.dropdown-icon');
  
  subtopicsDiv.classList.toggle('open');
  if (icon) {
    icon.classList.toggle('open');
  }
}

// Toggle subtopic menu (admin only)
window.toggleSubtopicMenu = function(unitId, subtopicId) {
  const menu = document.getElementById(`subtopic-menu-${unitId}-${subtopicId}`);
  const allMenus = document.querySelectorAll('.subtopic-menu-dropdown');
  allMenus.forEach(m => {
    if (m.id !== `subtopic-menu-${unitId}-${subtopicId}`) {
      m.classList.remove('show');
    }
  });
  menu.classList.toggle('show');
};

// Edit subtopic name (admin only)
window.editSubtopic = async function(unitId, subtopicId, currentName) {
  if (!currentUser) return alert("Login first");
  
  const isAdmin = checkAdminStatus(currentUser.email);
  if (!isAdmin) return alert("Only admins can edit topics");
  
  const newName = prompt("Enter new topic name:", currentName);
  if (!newName || newName.trim() === "" || newName.trim() === currentName) return;
  
  try {
    await updateDoc(doc(db, "units", unitId, "subtopics", subtopicId), {
      name: newName.trim()
    });
    alert("Topic name updated successfully!");
    loadUnits();
  } catch (error) {
    alert("Error updating topic: " + error.message);
    console.error("Error updating topic:", error);
  }
};

// Add subtopic (admin only)
async function addSubtopic(unitId) {
  if (!currentUser) return alert("Login first");
  
  const isAdmin = checkAdminStatus(currentUser.email);
  if (!isAdmin) return alert("Only admins can add topics");
  
  const name = prompt("Enter new topic name:");
  if (!name || name.trim() === "") return;
  
  try {
    await addDoc(collection(db, "units", unitId, "subtopics"), { 
      name: name.trim(),
      createdAt: Date.now()
    });
    alert("Topic added successfully!");
    loadUnits();
  } catch (error) {
    alert("Error adding topic: " + error.message);
    console.error("Error adding topic:", error);
  }
}

// Restore unit selection after page reload
async function restoreUnitSelection(savedUnit) {
  if (!savedUnit) return;
  
  console.log("Attempting to restore unit:", savedUnit);
  
  // Wait a bit for DOM to be ready
  await new Promise(resolve => setTimeout(resolve, 300));
  
  if (savedUnit.isMentor && savedUnit.subtopicId) {
    // Restore subtopic selection
    console.log("Restoring mentor subtopic:", savedUnit.subtopicName);
    const unitDiv = document.querySelector(`#subtopics-${savedUnit.id}`);
    if (unitDiv) {
      // Open the dropdown
      unitDiv.classList.add('open');
      const parentUnit = unitDiv.parentElement;
      const icon = parentUnit.querySelector('.dropdown-icon');
      if (icon) {
        icon.classList.add('open');
      }
      
      // Find and select the subtopic
      const subtopics = unitDiv.querySelectorAll('.subtopic');
      let found = false;
      subtopics.forEach(subDiv => {
        const nameSpan = subDiv.querySelector('.subtopic-name');
        if (nameSpan && nameSpan.textContent === savedUnit.subtopicName) {
          subDiv.classList.add('active');
          currentUnit = savedUnit;
          unitTitle.textContent = `${savedUnit.name} - ${savedUnit.subtopicName}`;
          toggleCodeBox();
          listenPosts();
          found = true;
          console.log("Subtopic restored and posts loading");
        }
      });
      
      if (!found) {
        console.log("Could not find subtopic:", savedUnit.subtopicName);
      }
    } else {
      console.log("Could not find subtopics container for unit:", savedUnit.id);
    }
  } else {
    // Restore regular unit selection
    console.log("Restoring regular unit:", savedUnit.name);
    const units = document.querySelectorAll('.unit');
    let found = false;
    units.forEach(unitDiv => {
      const unitText = unitDiv.textContent.replace('▼', '').trim();
      if (unitText === savedUnit.name) {
        unitDiv.classList.add('active');
        currentUnit = savedUnit;
        unitTitle.textContent = savedUnit.name;
        toggleCodeBox();
        listenPosts();
        found = true;
        console.log("Unit restored and posts loading");
      }
    });
    
    if (!found) {
      console.log("Could not find unit:", savedUnit.name);
    }
  }
}

// FIXED: Select subtopic with better element handling
function selectSubtopic(unitId, unitName, subtopicId, subtopicName, subtopicElement) {
  currentUnit = { 
    id: unitId, 
    name: unitName,
    subtopicId: subtopicId,
    subtopicName: subtopicName,
    isMentor: true
  };
  
  // Save selection to localStorage
  saveCurrentUnit();
  
  // Remove active from all units and subtopics
  document.querySelectorAll(".unit").forEach(u => u.classList.remove("active"));
  document.querySelectorAll(".subtopic").forEach(s => s.classList.remove("active"));
  
  // Highlight selected subtopic
  if (subtopicElement) {
    subtopicElement.classList.add("active");
  }
  
  unitTitle.textContent = `${unitName} - ${subtopicName}`;
  postsDiv.innerHTML = "";
  renderedPosts.clear();
  toggleCodeBox();
  listenPosts();
}

// Select Unit
function selectUnit(id, name, event) {
  currentUnit = { id, name };
  
  // Save selection to localStorage
  saveCurrentUnit();
  
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
  
  if (p.code && p.code.trim()) {
    card.classList.add("with-code");
  } else {
    card.classList.add("question-only");
  }

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
  const isOwnPost = currentUser && currentUser.email === p.userEmail;

  card.innerHTML = `
    ${isOwnPost ? `
      <div class="post-menu">
        <button class="post-menu-btn" onclick="togglePostMenu('${id}')">⋮</button>
        <div class="post-menu-dropdown" id="post-menu-${id}">
          <button class="post-menu-item" onclick="editPost('${id}')">✏️ Edit</button>
          <button class="post-menu-item delete" onclick="deletePost('${id}')">🗑️ Delete</button>
        </div>
      </div>
    ` : ''}
    <h3 id="question-${id}">${p.question}</h3>
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

        card.querySelector(`#avg-${id}`).innerText = `(${newAvg.toFixed(1)})`;
        card.querySelectorAll(`#rating-${id} span`).forEach((s, i) => {
          s.classList.toggle('filled', i < rating);
        });
      };
    });
  }
}

// Global functions
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

window.togglePostMenu = function(postId) {
  const menu = document.getElementById(`post-menu-${postId}`);
  const allMenus = document.querySelectorAll('.post-menu-dropdown');
  allMenus.forEach(m => {
    if (m.id !== `post-menu-${postId}`) {
      m.classList.remove('show');
    }
  });
  menu.classList.toggle('show');
};

window.editPost = async function(postId) {
  if (!currentUser) return alert("Login first");
  
  const postRef = doc(db, "posts", postId);
  const postSnap = await getDoc(postRef);
  
  if (!postSnap.exists()) return alert("Post not found");
  
  const postData = postSnap.data();
  
  if (postData.userEmail !== currentUser.email) {
    return alert("You can only edit your own posts");
  }
  
  const newQuestion = prompt("Edit your question:", postData.question);
  if (newQuestion === null) return;
  
  const newCode = prompt("Edit your code:", postData.code || "");
  if (newCode === null) return;
  
  try {
    await updateDoc(postRef, {
      question: newQuestion.trim(),
      code: newCode.trim(),
      editedAt: Date.now()
    });
    
    document.getElementById(`question-${postId}`).textContent = newQuestion.trim();
    const codeElement = document.getElementById(`code-${postId}`);
    if (codeElement) {
      codeElement.textContent = newCode.trim();
    }
    
    alert("Post updated successfully!");
    document.getElementById(`post-menu-${postId}`).classList.remove('show');
  } catch (error) {
    alert("Error updating post: " + error.message);
  }
};

window.deletePost = async function(postId) {
  if (!currentUser) return alert("Login first");
  
  const postRef = doc(db, "posts", postId);
  const postSnap = await getDoc(postRef);
  
  if (!postSnap.exists()) return alert("Post not found");
  
  const postData = postSnap.data();
  
  if (postData.userEmail !== currentUser.email) {
    return alert("You can only delete your own posts");
  }
  
  if (!confirm("Are you sure you want to delete this post?")) return;
  
  try {
    await updateDoc(postRef, { deleted: true });
    
    const postCard = document.getElementById(`post-${postId}`);
    if (postCard) {
      postCard.remove();
      renderedPosts.delete(postId);
    }
    
    alert("Post deleted successfully!");
  } catch (error) {
    alert("Error deleting post: " + error.message);
  }
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
  if (!currentUnit) {
    console.log("No current unit selected");
    return;
  }

  console.log("Loading posts for:", currentUnit);
  postsDiv.innerHTML = "";
  renderedPosts.clear();

  let q;
  
  if (currentUnit.isMentor && currentUnit.subtopicId) {
    console.log("Querying mentor subtopic posts");
    q = query(
      collection(db, "posts"),
      where("unitId", "==", currentUnit.id),
      where("subtopicId", "==", currentUnit.subtopicId),
      orderBy("ts", "asc")
    );
  } else {
    console.log("Querying regular unit posts");
    q = query(
      collection(db, "posts"),
      where("unitId", "==", currentUnit.id),
      orderBy("ts", "asc")
    );
  }

  onSnapshot(q, (snapshot) => {
    console.log(`Received ${snapshot.docs.length} posts from database`);
    
    // On initial load, render all existing posts
    if (snapshot.docs.length > 0 && renderedPosts.size === 0) {
      snapshot.docs.forEach((doc) => {
        const docData = doc.data();
        const docId = doc.id;
        
        if (!docData.isTemp && !docData.deleted) {
          renderPost(docId, docData);
        }
      });
      postsDiv.scrollTop = postsDiv.scrollHeight;
    } else {
      // For real-time updates
      snapshot.docChanges().forEach((change) => {
        const docData = change.doc.data();
        const docId = change.doc.id;

        if (docData.isTemp || docData.deleted) return;

        if (change.type === "added") {
          renderPost(docId, docData);
          postsDiv.scrollTop = postsDiv.scrollHeight;
        } else if (change.type === "removed" || (change.type === "modified" && docData.deleted)) {
          const postCard = document.getElementById(`post-${docId}`);
          if (postCard) {
            postCard.remove();
            renderedPosts.delete(docId);
          }
        }
      });
    }
  }, (error) => {
    console.error("Error listening to posts:", error);
    alert("Error loading posts: " + error.message);
  });
}

// Add Unit
addUnitBtn.onclick = async () => {
  if (!currentUser) return alert("Login first");

  const isAdmin = checkAdminStatus(currentUser.email);
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

  const isAdmin = checkAdminStatus(currentUser.email);

  if (currentUnit.name.toLowerCase().includes("mentor") && !isAdmin) {
    alert("Only admins can send messages in this unit.");
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
    deleted: false
  };

  if (currentUnit.isMentor && currentUnit.subtopicId) {
    newPost.subtopicId = currentUnit.subtopicId;
    newPost.subtopicName = currentUnit.subtopicName;
  }

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

  let q;
  
  if (currentUnit.isMentor && currentUnit.subtopicId) {
    q = query(
      collection(db, "posts"),
      where("unitId", "==", currentUnit.id),
      where("subtopicId", "==", currentUnit.subtopicId),
      orderBy("ts", "asc")
    );
  } else {
    q = query(
      collection(db, "posts"),
      where("unitId", "==", currentUnit.id),
      orderBy("ts", "asc")
    );
  }

  const qSnap = await getDocs(q);

  const results = [];
  qSnap.forEach((docu) => {
    const p = docu.data();
    if (p.deleted) return;
    
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
