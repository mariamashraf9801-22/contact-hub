// ContactHub - Smart Contact Manager
const STORAGE_KEY = 'contacthub_contacts';

let contacts = [];
let avatarTemp = ''; // holds uploaded photo (base64) while modal open

// ---------- Storage ----------
function loadContacts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    contacts = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(contacts)) contacts = [];
  } catch { contacts = []; }
}
function saveContacts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
}

// ---------- Elements ----------
const $ = (id) => document.getElementById(id);
const grid = $('contactsGrid'), emptyState = $('emptyState');
const searchInput = $('searchInput');
const modal = $('contactModal'), form = $('contactForm');

// ---------- Validation ----------
const nameRegex = /^[\p{L}\s]{2,50}$/u;          // letters + spaces, 2-50 chars
const phoneRegex = /^01[0125][0-9]{8}$/;          // Egyptian: 010/011/012/015 + 8 digits
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateName(v) { return nameRegex.test(v.trim()); }
function validatePhone(v) { return phoneRegex.test(v.trim().replace(/[\s-]/g, '')); }
function validateEmail(v) { v = v.trim(); return v === '' || emailRegex.test(v); }

function showError(input, errEl, bad) {
  errEl.style.display = bad ? 'block' : 'none';
  input.classList.toggle('invalid', bad);
  return !bad;
}

// Live validation on typing
[['contactName','contactNameError',validateName],
 ['contactPhone','contactPhoneError',validatePhone],
 ['contactEmail','contactEmailError',validateEmail]
].forEach(([i,e,fn]) => {
  $(i).addEventListener('input', () => showError($(i), $(e), !fn($(i).value)));
});

function openModal(editContact = null) {
  form.reset();
  $('contactId').value = '';
  avatarTemp = '';
  resetAvatarPreview();
  ['contactNameError','contactPhoneError','contactPhoneError','contactEmailError'].forEach(id => { const el = $(id); if (el) el.style.display = 'none'; });
  ['contactName','contactPhone','contactEmail'].forEach(id => $(id).classList.remove('invalid'));

  if (editContact) {
    $('modalTitle').textContent = 'Edit Contact';
    $('contactId').value = editContact.id;
    $('contactName').value = editContact.name;
    $('contactPhone').value = editContact.phone;
    $('contactEmail').value = editContact.email || '';
    $('contactAddress').value = editContact.address || '';
    $('contactGroup').value = editContact.group || '';
    $('contactNotes').value = editContact.notes || '';
    $('contactFavorite').checked = !!editContact.favorite;
    $('contactEmergency').checked = !!editContact.emergency;
    avatarTemp = editContact.avatar || '';
    if (avatarTemp) setAvatarPreview(avatarTemp);
  } else {
    $('modalTitle').textContent = 'Add New Contact';
  }
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  modal.style.display = 'none';
  document.body.style.overflow = '';
}

// Avatar upload
function setAvatarPreview(src) {
  $('avatarPreview').innerHTML = `<img src="${src}" alt="avatar">`;
}
function resetAvatarPreview() {
  $('avatarPreview').innerHTML = '<i class="fa-solid fa-user"></i>';
}
$('avatarInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { Swal.fire('Invalid file', 'Please choose an image file.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = (ev) => { avatarTemp = ev.target.result; setAvatarPreview(avatarTemp); };
  reader.readAsDataURL(file);
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('contactName').value, phone = $('contactPhone').value, email = $('contactEmail').value;

  const okName = showError($('contactName'), $('contactNameError'), !validateName(name));
  const okPhone = showError($('contactPhone'), $('contactPhoneError'), !validatePhone(phone));
  const okEmail = showError($('contactEmail'), $('contactEmailError'), !validateEmail(email));
  if (!okName || !okPhone || !okEmail) return;

  const cleanPhone = phone.trim().replace(/[\s-]/g, '');
  const id = $('contactId').value;
  const dup = contacts.find(c => c.phone === cleanPhone && String(c.id) !== String(id));
  if (dup) { Swal.fire('Duplicate phone', `This number already belongs to "${dup.name}".`, 'warning'); return; }

  const data = {
    name: name.trim(),
    phone: cleanPhone,
    email: email.trim(),
    address: $('contactAddress').value.trim(),
    group: $('contactGroup').value,
    notes: $('contactNotes').value.trim(),
    favorite: $('contactFavorite').checked,
    emergency: $('contactEmergency').checked,
    avatar: avatarTemp
  };

  if (id) {
    const i = contacts.findIndex(c => String(c.id) === String(id));
    if (i > -1) contacts[i] = { ...contacts[i], ...data };
    saveContacts(); render();
    closeModal();
    Swal.fire({ icon: 'success', title: 'Contact updated!', timer: 1500, showConfirmButton: false });
  } else {
    contacts.unshift({ id: Date.now().toString(), ...data });
    saveContacts(); render();
    closeModal();
    Swal.fire({ icon: 'success', title: 'Contact added!', text: `${data.name} was saved.`, timer: 1800, showConfirmButton: false });
  }
});

function deleteContact(id) {
  const c = contacts.find(x => String(x.id) === String(id));
  Swal.fire({
    title: 'Delete contact?',
    text: c ? `"${c.name}" will be permanently removed.` : 'This contact will be removed.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Yes, delete it!'
  }).then((res) => {
    if (res.isConfirmed) {
      contacts = contacts.filter(x => String(x.id) !== String(id));
      saveContacts(); render();
      Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1400, showConfirmButton: false });
    }
  });
}

function toggleFavorite(id) {
  const c = contacts.find(x => String(x.id) === String(id));
  if (!c) return;
  c.favorite = !c.favorite;
  saveContacts(); render();
}

// ---------- Rendering ----------
function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function contactCard(c) {
  const avatar = c.avatar ? `<div class="card-avatar"><img src="${c.avatar}" alt=""></div>`
                          : `<div class="card-avatar">${esc(initials(c.name))}</div>`;
  const group = c.group ? `<span class="card-group ${esc(c.group)}">${esc(c.group)}</span>` : '';
  const emg = c.emergency ? `<span class="badge-emg"><i class="fa-solid fa-heart-pulse"></i> Emergency</span>` : '';
  return `
  <div class="contact-card">
    <button class="fav-star ${c.favorite ? 'active' : ''}" onclick="toggleFavorite('${c.id}')" title="Toggle favorite">
      <i class="${c.favorite ? 'fa-solid' : 'fa-regular'} fa-star"></i>
    </button>
    <div class="card-top">${avatar}
      <div><div class="card-name">${esc(c.name)}</div><div>${group}${emg}</div></div>
    </div>
    <div class="card-info"><i class="fa-solid fa-phone"></i><span>${esc(c.phone)}</span></div>
    ${c.email ? `<div class="card-info"><i class="fa-solid fa-envelope"></i><span>${esc(c.email)}</span></div>` : ''}
    ${c.address ? `<div class="card-info"><i class="fa-solid fa-location-dot"></i><span>${esc(c.address)}</span></div>` : ''}
    ${c.notes ? `<div class="card-notes">${esc(c.notes)}</div>` : ''}
    <div class="card-actions">
      <a class="action-btn call" href="tel:${esc(c.phone)}"><i class="fa-solid fa-phone"></i> Call</a>
      ${c.email ? `<a class="action-btn mail" href="mailto:${esc(c.email)}"><i class="fa-solid fa-envelope"></i> Email</a>` : ''}
      <button class="action-btn edit" onclick="editContact('${c.id}')"><i class="fa-solid fa-pen"></i></button>
      <button class="action-btn del" onclick="deleteContact('${c.id}')"><i class="fa-solid fa-trash"></i></button>
    </div>
  </div>`;
}

function miniCard(c, isEmg) {
  const avatar = c.avatar ? `<div class="mini-avatar"><img src="${c.avatar}" alt=""></div>`
                          : `<div class="mini-avatar">${esc(initials(c.name))}</div>`;
  return `<div class="mini-card">${avatar}
    <div><div class="mini-name">${esc(c.name)}</div><div class="mini-phone">${esc(c.phone)}</div></div>
    <a class="mini-call" href="tel:${esc(c.phone)}" title="Call"><i class="fa-solid fa-phone"></i></a>
  </div>`;
}

function filteredContacts() {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) return contacts;
  return contacts.filter(c => {
    return (c.name || '').toLowerCase().includes(q)
        || (c.phone || '').includes(q)
        || (c.email || '').toLowerCase().includes(q);
  });
}

function render() {
  const list = filteredContacts();
  grid.innerHTML = list.map(contactCard).join('');
  emptyState.style.display = list.length ? 'none' : 'block';

  $('totalCount').textContent = contacts.length;
  $('favCount').textContent = contacts.filter(c => c.favorite).length;
  $('emgCount').textContent = contacts.filter(c => c.emergency).length;

  const favs = contacts.filter(c => c.favorite);
  const emgs = contacts.filter(c => c.emergency);
  const favHTML = favs.length ? favs.map(c => miniCard(c)).join('') : '<div class="side-empty">No favorites yet.<br>Star a contact ⭐</div>';
  const emgHTML = emgs.length ? emgs.map(c => miniCard(c, true)).join('') : '<div class="side-empty">No emergency contacts.</div>';

  $('favList').innerHTML = favHTML;
  $('emgList').innerHTML = emgHTML;
}

// Global functions used by inline onclick
window.toggleFavorite = toggleFavorite;
window.deleteContact = deleteContact;
window.editContact = (id) => {
  const c = contacts.find(x => String(x.id) === String(id));
  if (c) openModal(c);
};

// ---------- Events ----------
$('addContactBtn').addEventListener('click', () => openModal());
$('closeModalBtn').addEventListener('click', closeModal);
$('cancelModalBtn').addEventListener('click', closeModal);
$('modalBackdrop').addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
searchInput.addEventListener('input', render);


loadContacts();
render();
