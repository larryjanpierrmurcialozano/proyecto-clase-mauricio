/* Frontend - DropSport (API Flask/MySQL) */
const state = { current: null, inventory: [], reservations: [], tickets: [], selectedCategory: 'todos', inventorySearch: '', manageSearch: '', manageType: 'todos', ticketFilter: 'todos' }
let uiReady = false
const $ = id => document.getElementById(id)
const show = el => el.classList.remove('hidden')
const hide = el => el.classList.add('hidden')
const formatCOP = value => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value || 0))
const normalizeText = (value='') => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

const categoryMap = {
  'pelota': 'balones', 'futbol': 'balones', 'bal\u00f3n': 'balones', 'basketball': 'balones', 'baloncesto': 'balones',
  'raqueta': 'herramientas', 'bate': 'herramientas', 'remo': 'herramientas',
  'uniforme': 'vestimenta', 'jersey': 'vestimenta', 'remera': 'vestimenta', 'camiseta': 'vestimenta', 'pantal\u00f3n': 'vestimenta',
  'bicicleta': 'cancha', 'patinete': 'cancha', 'patines': 'cancha', 'arco': 'cancha', 'red': 'cancha', 'conos': 'cancha',
  'cancha': 'cancha', 'cantle': 'cancha'
}

function getCategory(name=''){
  const lower = name.toLowerCase()
  for(let key in categoryMap) if(lower.includes(key)) return categoryMap[key]
  return 'cancha'
}

// FA icon lookup (replaces broken emoji chars)
const sportIcons = {
  'pelota': 'fa-futbol', 'futbol': 'fa-futbol', 'balon': 'fa-futbol',
  'basketball': 'fa-basketball', 'baloncesto': 'fa-basketball', 'basquet': 'fa-basketball',
  'voleibol': 'fa-volleyball', 'raqueta': 'fa-table-tennis-paddle-ball', 'tenis': 'fa-table-tennis-paddle-ball',
  'bicicleta': 'fa-bicycle', 'patines': 'fa-shoe-prints', 'patineta': 'fa-shoe-prints',
  'natacion': 'fa-person-swimming', 'golf': 'fa-golf-ball-tee',
  'bate': 'fa-baseball-bat-ball', 'jersey': 'fa-shirt', 'uniforme': 'fa-shirt',
  'camiseta': 'fa-shirt', 'pantalon': 'fa-shirt', 'red': 'fa-table-tennis-paddle-ball',
  'conos': 'fa-road', 'arco': 'fa-bullseye', 'ski': 'fa-person-skiing'
}
function getIcon(name=''){
  const lower = name.toLowerCase()
  for(let key in sportIcons) if(lower.includes(key)) return sportIcons[key]
  return 'fa-dumbbell'
}

async function api(path, method='GET', body){
  const opts = { method, headers: {} }
  const token = localStorage.getItem('dsp_token')
  if(token) opts.headers['Authorization'] = 'Bearer ' + token
  if(body){ opts.headers['Content-Type']='application/json'; opts.body = JSON.stringify(body) }
  const res = await fetch(path, opts)
  if(res.headers.get('content-type') && res.headers.get('content-type').includes('application/json')) return res.json()
  return null
}

function initUI(){
  if(uiReady) return
  uiReady = true
  const on = (id, ev, fn)=>{ const el=$(id); if(el) el.addEventListener(ev,fn) }
  on('ctaLogin','click',()=>location.href='login.html')
  on('ctaRegister','click',()=>location.href='register.html')
  on('toggleTheme','click',toggleTheme)

  on('doRegister','click',onRegister)
  on('doLogin','click',onLogin)
  on('recoverSubmit','click',onRecover)
  on('recoverCancel','click',resetRecoveryForm)

  on('navInventory','click',()=>showView('inventory'))
  on('navManage','click',()=>showView('manage'))
  on('navLoans','click',()=>showView('loans'))
  on('navTickets','click',()=>showView('tickets'))
  on('navReports','click',()=>showView('reports'))
  on('logout','click',()=>{ localStorage.removeItem('dsp_token'); location.href='login.html' })
  on('addItemBtn','click',openAddItem)
  on('inventorySearch','input',(e)=>{ state.inventorySearch = e.target.value || ''; renderInventory() })
  on('manageSearch','input',(e)=>{ state.manageSearch = e.target.value || ''; renderManageProducts() })
  on('manageType','change',(e)=>{ state.manageType = e.target.value || 'todos'; renderManageProducts() })
  on('manageApplyAllPrice','click',applyGlobalPrice)
  on('manageApplyBulkName','click',applyBulkName)
  on('manageBulkType','change',populateBulkNameOptions)
  on('modalClose','click',closeModal)
  on('ticketFilter','change',(e)=>{ state.ticketFilter = e.target.value || 'todos'; renderTickets() })
  on('newTicketBtn','click',openNewTicketModal)

  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'))
      e.target.classList.add('active')
      state.selectedCategory = e.target.dataset.category
      renderInventory()
    })
  })
}

function resetRecoveryForm(){
  const details = document.querySelector('.recovery-visual')
  const err = $('recoverError')
  if(err) err.textContent = ''
  const email = $('recoverEmail')
  const pass = $('recoverPass')
  const pass2 = $('recoverPass2')
  if(email) email.value = ''
  if(pass) pass.value = ''
  if(pass2) pass2.value = ''
  if(details) details.removeAttribute('open')
}

async function onRegister(e){
  e.preventDefault()
  const name = $('regName').value.trim(), email=$('regEmail').value.trim(), pass=$('regPass').value, pass2=$('regPass2').value, role=$('regRole').value
  const err = $('registerError'); err.textContent=''
  if(!name || !email || !pass){ err.textContent='Complete todos los campos.'; return }
  if(pass!==pass2){ err.textContent='Las contrase\u00f1as no coinciden.'; return }
  const res = await api('/api/register','POST',{name, email, password: pass, role})
  if(!res || !res.ok){ err.textContent = res? res.msg : 'Error de conexi\u00f3n'; return }
  alert('Registro exitoso.')
  location.href = 'login.html'
}

async function onLogin(e){
  e.preventDefault()
  const user = $('loginUser').value.trim(), pass=$('loginPass').value
  const err = $('loginError'); err.textContent=''
  if(!user || !pass){ err.textContent='Complete usuario y contrase\u00f1a.'; return }
  const res = await api('/api/login','POST',{user, password: pass})
  if(!res || !res.ok){ err.textContent = res? res.msg : 'Error de conexi\u00f3n'; return }
  state.current = res.user
  if(res.token) localStorage.setItem('dsp_token', res.token)
  if(res.user.role === 'cliente'){
    location.href = 'cliente.html'
  } else {
    location.href = 'dashboard.html'
  }
}

async function onRecover(e){
  e.preventDefault()
  const email = ($('recoverEmail') && $('recoverEmail').value || '').trim()
  const pass = $('recoverPass') ? $('recoverPass').value : ''
  const pass2 = $('recoverPass2') ? $('recoverPass2').value : ''
  const err = $('recoverError')
  if(err) err.textContent = ''
  if(!email || !pass || !pass2){ if(err) err.textContent='Complete todos los campos.'; return }
  if(pass !== pass2){ if(err) err.textContent='Las contrasenas no coinciden.'; return }
  const res = await api('/api/recover','POST',{email, password: pass})
  if(!res || !res.ok){ if(err) err.textContent = res? res.msg : 'Error de conexion'; return }
  if(err) err.textContent = 'Contrasena actualizada. Ya puedes iniciar sesion.'
}

// Dashboard init
document.addEventListener('DOMContentLoaded', () => {
  initUI()
})

if(window.location.pathname.endsWith('dashboard.html')){
  (async ()=>{
    const me = await api('/api/me')
    if(!me || !me.ok){
      localStorage.removeItem('dsp_token')
      location.href = 'login.html'
    } else {
      state.current = me.user
      initUI()
      await refreshData()
      const userEl = $('userInfo')
      if(userEl){
        const roleLabels = { administrador: 'Administrador', empleado: 'Empleado', cliente: 'Cliente' }
        userEl.innerHTML = state.current.name + ' &mdash; <span class="role-badge">' + (roleLabels[state.current.role] || state.current.role) + '</span>'
      }
      showView('inventory')
    }
  })()
}

function showView(v){
  const views = ['inventory','manage','loans','tickets','reports']
  views.forEach(x=>{const el=$(x+'View'); if(el){ if(x===v) show(el); else hide(el) }})
  const navMap = { inventory:'navInventory', manage:'navManage', loans:'navLoans', tickets:'navTickets', reports:'navReports' }
  Object.entries(navMap).forEach(([key, id]) => {
    const btn = $(id)
    if(btn){
      if(key === v) btn.classList.add('active-nav')
      else btn.classList.remove('active-nav')
    }
  })
  if(v==='manage') renderManageProducts()
  if(v==='reports') renderReports()
  if(v==='loans') renderLoans()
  if(v==='tickets') renderTickets()
}

async function refreshData(){
  try{
    const inv = await api('/api/inventory')
    const resv = await api('/api/reservations')
    const tix = await api('/api/tickets')
    state.inventory = Array.isArray(inv)? inv : []
    state.reservations = Array.isArray(resv)? resv : []
    state.tickets = Array.isArray(tix)? tix : []
    renderInventory(); renderManageProducts(); renderLoans(); renderReports(); renderTickets()
  }catch(err){ console.warn('No se pudo conectar al API', err) }
}

function renderInventory(){
  const list = $('inventoryList'); if(!list) return; list.innerHTML=''
  const searchText = normalizeText(state.inventorySearch)
  const filtered = state.inventory.filter(item => {
    const byCategory = state.selectedCategory === 'todos' || getCategory(item.name) === state.selectedCategory
    const bySearch = !searchText || normalizeText(item.name || '').includes(searchText)
    return byCategory && bySearch
  })

  if(filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>No hay productos en esta categor\u00eda</p></div>'
    return
  }

  filtered.forEach(item => {
    const icon = getIcon(item.name)
    const row = document.createElement('div')
    row.className = 'inv-row'
    const imgHtml = item.image
      ? '<img src="' + item.image + '" alt="' + item.name + '" class="inv-row-thumb">'
      : '<div class="inv-row-thumb placeholder"><i class="fa-solid ' + icon + '"></i></div>'
    row.innerHTML =
      '<div class="inv-row-left">' +
        imgHtml +
        '<div class="inv-row-info">' +
          '<div class="inv-row-name"><i class="fa-solid ' + icon + '"></i> ' + item.name + '</div>' +
          '<div class="inv-row-cat"><i class="fa-solid fa-tag"></i> ' + getCategory(item.name) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="inv-row-center">' +
        '<span class="badge ' + (item.status || 'disponible') + '">' + (item.status || 'disponible') + '</span>' +
        '<span class="condition-badge condition-' + (item.condition || 'bueno') + '"><i class="fa-solid fa-heart-pulse"></i> ' + (item.condition || 'bueno') + '</span>' +
        '<span class="price-text">' + formatCOP(item.price || 10000) + '</span>' +
      '</div>' +
      '<div class="inv-row-actions">' +
        '<button class="btn small outline edit-btn"><i class="fa-solid fa-pen"></i></button>' +
        '<button class="btn small loan-btn"><i class="fa-solid fa-hand-holding"></i> Alquilar</button>' +
        '<button class="btn small outline return-btn"><i class="fa-solid fa-file-lines"></i> Generar Reporte</button>' +
        '<button class="btn small plain maint-btn"><i class="fa-solid fa-wrench"></i> Mantenimiento</button>' +
      '</div>'
    row.querySelector('.edit-btn').onclick = function(){ openEditModal(item) }
    row.querySelector('.loan-btn').onclick = function(){ openLoanModal(item) }
    row.querySelector('.return-btn').onclick = function(){ returnItem(item.id) }
    row.querySelector('.maint-btn').onclick = function(){ markMaintenance(item.id) }
    list.appendChild(row)
  })
}

function renderManageProducts(){
  const list = $('manageList')
  const totalEl = $('manageTotalProducts')
  const availableEl = $('manageAvailableProducts')
  const unavailableEl = $('manageUnavailableProducts')
  const maintenanceEl = $('manageMaintenanceProducts')
  const typeBalonesEl = $('manageTypeBalones')
  const typeVestimentaEl = $('manageTypeVestimenta')
  const typeHerramientasEl = $('manageTypeHerramientas')
  const typeCanchaEl = $('manageTypeCancha')
  const globalPriceEl = $('manageGlobalPrice')
  if(!list) return

  const total = state.inventory.length
  const available = state.inventory.filter(item => (item.status || 'disponible') === 'disponible').length
  const maintenance = state.inventory.filter(item => (item.status || 'disponible') === 'mantenimiento').length
  const unavailable = total - available
  const byType = { balones: 0, vestimenta: 0, herramientas: 0, cancha: 0 }
  state.inventory.forEach(item => { const t = getCategory(item.name); if(byType[t] !== undefined) byType[t]++ })

  if(totalEl) totalEl.textContent = String(total)
  if(availableEl) availableEl.textContent = String(available)
  if(unavailableEl) unavailableEl.textContent = String(unavailable)
  if(maintenanceEl) maintenanceEl.textContent = String(maintenance)
  if(typeBalonesEl) typeBalonesEl.textContent = String(byType.balones)
  if(typeVestimentaEl) typeVestimentaEl.textContent = String(byType.vestimenta)
  if(typeHerramientasEl) typeHerramientasEl.textContent = String(byType.herramientas)
  if(typeCanchaEl) typeCanchaEl.textContent = String(byType.cancha)
  populateBulkNameOptions()
  const selectedBulkItems = getBulkSelectedItems()
  if(globalPriceEl && selectedBulkItems.length > 0) globalPriceEl.value = String(selectedBulkItems[0].price || 10000)

  list.innerHTML=''
  if(state.inventory.length === 0){
    list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-box-open"></i><p>No hay productos para gestionar.</p></div>'
    return
  }

  const textFilter = normalizeText(state.manageSearch)
  const typeFilter = state.manageType || 'todos'
  const filtered = state.inventory.filter(item => {
    const matchesText = !textFilter || normalizeText(item.name || '').includes(textFilter)
    const matchesType = typeFilter === 'todos' || getCategory(item.name) === typeFilter
    return matchesText && matchesType
  })

  if(filtered.length === 0){
    list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-search"></i><p>No hay productos que coincidan.</p></div>'
    return
  }

  filtered.forEach(item => {
    const icon = getIcon(item.name)
    const row = document.createElement('div')
    row.className = 'card manage-row'
    row.innerHTML =
      '<div>' +
        '<strong><i class="fa-solid ' + icon + '"></i> ' + item.name + '</strong>' +
        '<div style="margin-top:4px;color:var(--muted);font-size:0.88rem"><i class="fa-solid fa-tag"></i> ' + getCategory(item.name) + '</div>' +
        '<div class="price-text" style="margin-top:6px">Precio: ' + formatCOP(item.price || 10000) + '</div>' +
        '<div class="manage-price-inline" style="margin-top:8px">' +
          '<input type="number" min="0" step="1" value="' + (item.price || 10000) + '" class="manage-price-input" aria-label="Precio ' + item.name + '">' +
          '<button class="btn small outline manage-price-save"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>' +
        '</div>' +
        '<div style="margin-top:6px"><span class="badge ' + (item.status || 'disponible') + '">' + (item.status || 'disponible') + '</span></div>' +
      '</div>' +
      '<button class="btn small outline delete-item-btn" style="color:var(--danger);border-color:var(--danger)"><i class="fa-solid fa-trash"></i> Eliminar</button>'
    row.querySelector('.manage-price-save').onclick = async function(){
      var value = Number(row.querySelector('.manage-price-input').value)
      if(!Number.isFinite(value) || value < 0) return alert('Precio inv\u00e1lido')
      await updateItemPrice(item.id, value)
    }
    row.querySelector('.delete-item-btn').onclick = function(){
      if(confirm('\u00bfEliminar "' + item.name + '"?')) deleteItem(item.id)
    }
    list.appendChild(row)
  })
}

function openLoanModal(item){
  var body = $('modalBody'); body.innerHTML=''
  var condLabel = item.condition || 'bueno'
  body.innerHTML =
    '<h3 style="margin-bottom:20px"><i class="fa-solid fa-hand-holding"></i> Alquilar: ' + item.name + '</h3>' +
    '<div class="condition-info-box">' +
      '<i class="fa-solid fa-heart-pulse"></i> Estado actual del producto: <span class="condition-badge condition-' + condLabel + '">' + condLabel + '</span>' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-user"></i> Cliente</label>' +
      '<input id="loanClient" placeholder="Nombre del cliente">' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-id-card"></i> Documento / C\u00e9dula</label>' +
      '<input id="loanDocument" placeholder="Ej: 1234567890">' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-phone"></i> Tel\u00e9fono</label>' +
      '<input id="loanPhone" type="tel" placeholder="Ej: 300 123 4567">' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-calendar"></i> Fecha inicio</label>' +
      '<input id="loanFrom" type="date">' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-calendar-check"></i> Fecha fin</label>' +
      '<input id="loanTo" type="date">' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-money-bill-wave"></i> Precio (COP)</label>' +
      '<input id="loanPrice" type="number" min="0" step="1" value="' + (item.price || 10000) + '" style="color:var(--success);font-weight:700">' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:20px">' +
      '<button id="confirmLoan" class="btn" style="flex:1;background:linear-gradient(135deg,var(--success),#059669)"><i class="fa-solid fa-check"></i> Confirmar</button>' +
      '<button class="btn outline" onclick="closeModal()"><i class="fa-solid fa-xmark"></i> Cancelar</button>' +
    '</div>'
  show($('modal'))
  $('confirmLoan').onclick = function(){ confirmLoan(item.id) }
}

function closeModal(){ hide($('modal')) }

async function confirmLoan(itemId){
  const client = $('loanClient').value.trim(), from=$('loanFrom').value, to=$('loanTo').value
  const document = $('loanDocument').value.trim()
  const phone = $('loanPhone').value.trim()
  const price = Number($('loanPrice').value)
  if(!client || !from || !to){ alert('Complete todos los campos.'); return }
  if(!Number.isFinite(price) || price < 0){ alert('Precio inv\u00e1lido.'); return }
  const res = await api('/api/loan','POST',{itemId, client, document, phone, from, to, price})
  if(res && res.ok){ await refreshData(); closeModal() }
  else alert(res? res.msg : 'Error al crear pr\u00e9stamo')
}

function renderLoans(){
  const list = $('loansList'); if(!list) return; list.innerHTML=''
  const loanedItems = state.inventory.filter(i => i.status === 'alquilado')

  if(loanedItems.length === 0){
    list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-hand-holding-heart"></i><p>No hay pr\u00e9stamos activos</p></div>'
    return
  }

  loanedItems.forEach(item => {
    const icon = getIcon(item.name)
    const reservation = state.reservations.find(r => r.item_id === item.id)
    const row = document.createElement('div')
    row.className = 'loan-row'

    var detailHtml = ''
    if(reservation){
      detailHtml =
        '<div class="loan-row-detail"><i class="fa-solid fa-user"></i> ' + reservation.client + '</div>' +
        (reservation.document ? '<div class="loan-row-detail"><i class="fa-solid fa-id-card"></i> ' + reservation.document + '</div>' : '') +
        (reservation.phone ? '<div class="loan-row-detail"><i class="fa-solid fa-phone"></i> ' + reservation.phone + '</div>' : '') +
        '<div class="loan-row-detail"><i class="fa-solid fa-calendar"></i> ' + reservation.start_date + ' &rarr; ' + reservation.end_date + '</div>'
    } else {
      detailHtml = '<div class="loan-row-detail"><i class="fa-solid fa-info-circle"></i> Sin datos de reserva</div>'
    }
    var loanPrice = reservation ? reservation.price : (item.price || 10000)

    row.innerHTML =
      '<div class="loan-row-info">' +
        '<div class="loan-row-name"><i class="fa-solid ' + icon + '"></i> ' + item.name + '</div>' +
        detailHtml +
        '<div class="loan-row-detail price-text"><i class="fa-solid fa-money-bill-wave"></i> ' + formatCOP(loanPrice) + '</div>' +
      '</div>' +
      '<div class="loan-row-actions">' +
        '<button class="btn small return-loan-btn"><i class="fa-solid fa-file-lines"></i> Generar Reporte</button>' +
        '<button class="btn small outline maint-loan-btn"><i class="fa-solid fa-wrench"></i> Mantenimiento</button>' +
      '</div>'
    row.querySelector('.return-loan-btn').onclick = function(){ returnItem(item.id) }
    row.querySelector('.maint-loan-btn').onclick = function(){ markMaintenance(item.id) }
    list.appendChild(row)
  })
}

async function returnItem(itemId){
  var item = state.inventory.find(function(i){ return i.id === itemId })
  if(!item) return
  var body = $('modalBody'); body.innerHTML=''
  var condLabel = item.condition || 'bueno'
  body.innerHTML =
    '<h3 style="margin-bottom:20px"><i class="fa-solid fa-file-lines"></i> Reporte de Devoluci\u00f3n: ' + item.name + '</h3>' +
    '<div class="condition-info-box">' +
      '<i class="fa-solid fa-heart-pulse"></i> Estado al alquilar: <span class="condition-badge condition-' + condLabel + '">' + condLabel + '</span>' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-heart-pulse"></i> Estado al devolver</label>' +
      '<select id="returnCondition">' +
        '<option value="bueno"' + (condLabel === 'bueno' ? ' selected' : '') + '>Bueno</option>' +
        '<option value="regular"' + (condLabel === 'regular' ? ' selected' : '') + '>Regular</option>' +
        '<option value="deterioro">Deterioro</option>' +
      '</select>' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-clipboard"></i> Descripci\u00f3n del estado</label>' +
      '<textarea id="returnDescription" rows="3" placeholder="Describa el estado del producto al ser devuelto..." style="width:100%;padding:11px 14px;border-radius:var(--radius-sm);border:2px solid var(--muted-border);background:var(--bg);color:var(--text);font-family:inherit;font-size:0.95rem;resize:vertical"></textarea>' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:20px">' +
      '<button id="confirmReturn" class="btn" style="flex:1"><i class="fa-solid fa-check"></i> Generar Reporte y Devolver</button>' +
      '<button class="btn outline" onclick="closeModal()"><i class="fa-solid fa-xmark"></i> Cancelar</button>' +
    '</div>'
  show($('modal'))
  $('confirmReturn').onclick = async function(){
    var condition = $('returnCondition').value
    var description = ($('returnDescription').value || '').trim()
    var res = await api('/api/return','POST',{itemId: itemId, condition: condition, description: description})
    if(res && res.ok){ await refreshData(); closeModal() }
    else alert(res ? res.msg : 'Error al devolver')
  }
}

async function markMaintenance(itemId){
  var item = state.inventory.find(function(i){ return i.id === itemId })
  if(!item) return
  var body = $('modalBody'); body.innerHTML=''
  var condLabel = item.condition || 'bueno'
  body.innerHTML =
    '<h3 style="margin-bottom:20px"><i class="fa-solid fa-wrench"></i> Enviar a Mantenimiento: ' + item.name + '</h3>' +
    '<div class="condition-info-box">' +
      '<i class="fa-solid fa-heart-pulse"></i> Estado actual: <span class="condition-badge condition-' + condLabel + '">' + condLabel + '</span>' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-heart-pulse"></i> Estado reportado</label>' +
      '<select id="maintCondition">' +
        '<option value="bueno"' + (condLabel === 'bueno' ? ' selected' : '') + '>Bueno</option>' +
        '<option value="regular"' + (condLabel === 'regular' ? ' selected' : '') + '>Regular</option>' +
        '<option value="deterioro"' + (condLabel === 'deterioro' ? ' selected' : '') + '>Deterioro</option>' +
      '</select>' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-clipboard"></i> Descripci\u00f3n del mantenimiento</label>' +
      '<textarea id="maintDescription" rows="3" placeholder="Describa la raz\u00f3n del mantenimiento..." style="width:100%;padding:11px 14px;border-radius:var(--radius-sm);border:2px solid var(--muted-border);background:var(--bg);color:var(--text);font-family:inherit;font-size:0.95rem;resize:vertical"></textarea>' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:20px">' +
      '<button id="confirmMaint" class="btn" style="flex:1"><i class="fa-solid fa-check"></i> Enviar a Mantenimiento</button>' +
      '<button class="btn outline" onclick="closeModal()"><i class="fa-solid fa-xmark"></i> Cancelar</button>' +
    '</div>'
  show($('modal'))
  $('confirmMaint').onclick = async function(){
    var condition = $('maintCondition').value
    var description = ($('maintDescription').value || '').trim()
    if(!description) return alert('Ingresa una descripci\u00f3n del mantenimiento')
    // Change status to mantenimiento
    var res1 = await api('/api/items/' + itemId + '/status','POST',{status:'mantenimiento'})
    if(!res1 || !res1.ok){ alert(res1 ? res1.msg : 'Error'); return }
    // Create maintenance ticket
    var res2 = await api('/api/tickets','POST',{
      item_id: itemId, ticket_type: 'mantenimiento',
      condition_before: condLabel, condition_after: condition,
      description: description
    })
    if(res2 && res2.ok){
      await refreshData()
      closeModal()
      // Navigate to tickets view
      state.current = 'tickets'
      renderAll()
    } else {
      alert(res2 ? res2.msg : 'Error al crear reporte de mantenimiento')
    }
  }
}

async function deleteItem(itemId){
  const res = await api('/api/items/' + itemId,'DELETE')
  if(res && res.ok){ alert('Producto eliminado'); await refreshData() }
  else alert(res? res.msg : 'Error al eliminar')
}

async function updateItemPrice(itemId, price){
  const res = await api('/api/items/' + itemId + '/price','POST',{price})
  if(res && res.ok) await refreshData()
  else alert(res ? res.msg : 'Error al actualizar precio')
}

async function applyGlobalPrice(){
  const globalInput = $('manageGlobalPrice')
  if(!globalInput) return
  const price = Number(globalInput.value)
  if(!Number.isFinite(price) || price < 0) return alert('Precio inv\u00e1lido')
  const items = getBulkSelectedItems()
  if(items.length === 0) return alert('No hay art\u00edculos que coincidan')
  const res = await api('/api/items/bulk-update','POST',{ids: items.map(function(i){return i.id}), price: price})
  if(res && res.ok){
    alert('Precio actualizado a ' + formatCOP(price) + ' para ' + (res.updated || 0) + ' productos')
    await refreshData()
  } else alert(res ? res.msg : 'Error al aplicar precio')
}

function getBulkSelectedItems(){
  const typeFilter = $('manageBulkType') ? $('manageBulkType').value : 'todos'
  const nameFilter = $('manageBulkName') ? $('manageBulkName').value : 'todos'
  return state.inventory.filter(function(item){
    const byType = typeFilter === 'todos' || getCategory(item.name) === typeFilter
    const byName = nameFilter === 'todos' || item.name === nameFilter
    return byType && byName
  })
}

function populateBulkNameOptions(){
  const nameSelect = $('manageBulkName'), typeSelect = $('manageBulkType')
  if(!nameSelect || !typeSelect) return
  const current = nameSelect.value || 'todos'
  const selectedType = typeSelect.value || 'todos'
  const names = [...new Set(
    state.inventory.filter(function(item){ return selectedType === 'todos' || getCategory(item.name) === selectedType }).map(function(item){ return item.name })
  )].sort(function(a, b){ return a.localeCompare(b, 'es') })
  nameSelect.innerHTML = '<option value="todos">Todos los nombres</option>'
  names.forEach(function(name){ var opt = document.createElement('option'); opt.value = name; opt.textContent = name; nameSelect.appendChild(opt) })
  if(names.includes(current)) nameSelect.value = current; else nameSelect.value = 'todos'
}

async function applyBulkName(){
  const input = $('manageBulkNewName')
  if(!input) return
  const name = (input.value || '').trim()
  if(!name) return alert('Ingresa un nombre v\u00e1lido')
  const items = getBulkSelectedItems()
  if(items.length === 0) return alert('No hay art\u00edculos que coincidan')
  const res = await api('/api/items/bulk-update','POST',{ids: items.map(function(i){return i.id}), name: name})
  if(res && res.ok){
    alert('Nombre actualizado en ' + (res.updated || 0) + ' productos')
    input.value = ''
    await refreshData()
  } else alert(res ? res.msg : 'Error al renombrar')
}

function openEditModal(item){
  var body = $('modalBody'); body.innerHTML=''
  var icon = getIcon(item.name)
  var cond = item.condition || 'bueno'
  var st = item.status || 'disponible'
  var canChangeStatus = (st === 'disponible' || st === 'mantenimiento')
  body.innerHTML =
    '<h3 style="margin-bottom:20px"><i class="fa-solid fa-pen"></i> Editar: ' + item.name + '</h3>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-box"></i> Nombre</label>' +
      '<input id="editName" value="' + item.name.replace(/"/g, '&quot;') + '">' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-heart-pulse"></i> Estado f\u00edsico</label>' +
      '<select id="editCondition">' +
        '<option value="bueno"' + (cond === 'bueno' ? ' selected' : '') + '>Bueno</option>' +
        '<option value="regular"' + (cond === 'regular' ? ' selected' : '') + '>Regular</option>' +
        '<option value="deterioro"' + (cond === 'deterioro' ? ' selected' : '') + '>Deterioro</option>' +
      '</select>' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-circle-info"></i> Estado de disponibilidad</label>' +
      '<select id="editStatus"' + (canChangeStatus ? '' : ' disabled') + '>' +
        '<option value="disponible"' + (st === 'disponible' ? ' selected' : '') + '>Disponible</option>' +
        '<option value="mantenimiento"' + (st === 'mantenimiento' ? ' selected' : '') + '>En mantenimiento</option>' +
        (st === 'alquilado' ? '<option value="alquilado" selected disabled>Alquilado (devuelva primero)</option>' : '') +
      '</select>' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:20px">' +
      '<button id="confirmEdit" class="btn" style="flex:1"><i class="fa-solid fa-check"></i> Guardar</button>' +
      '<button class="btn outline" onclick="closeModal()"><i class="fa-solid fa-xmark"></i> Cancelar</button>' +
    '</div>'
  show($('modal'))
  $('confirmEdit').onclick = async function(){
    var newName = $('editName').value.trim()
    if(!newName) return alert('Nombre requerido')
    var newCond = $('editCondition').value
    var newStatus = $('editStatus').value
    var res = await api('/api/items/' + item.id + '/name', 'POST', {name: newName})
    if(res && res.ok){
      await api('/api/items/' + item.id + '/condition', 'POST', {condition: newCond})
      if(canChangeStatus && newStatus !== st){
        await api('/api/items/' + item.id + '/status', 'POST', {status: newStatus})
      }
      await refreshData(); closeModal()
    } else alert(res ? res.msg : 'Error al renombrar')
  }
}

function openAddItem(){
  var body = $('modalBody'); body.innerHTML=''
  body.innerHTML =
    '<h3 style="margin-bottom:20px"><i class="fa-solid fa-plus-circle"></i> Nuevo art\u00edculo</h3>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-box"></i> Nombre del art\u00edculo</label>' +
      '<input id="newName" placeholder="Ej: Pelota de f\u00fatbol">' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-tag"></i> Categor\u00eda</label>' +
      '<select id="newCategory">' +
        '<option value="balones">Balones</option>' +
        '<option value="vestimenta">Vestimenta</option>' +
        '<option value="herramientas">Herramientas</option>' +
        '<option value="cancha">Cancha / Equipamiento</option>' +
      '</select>' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-heart-pulse"></i> Estado f\u00edsico inicial</label>' +
      '<select id="newCondition">' +
        '<option value="bueno" selected>Bueno</option>' +
        '<option value="regular">Regular</option>' +
        '<option value="deterioro">Deterioro</option>' +
      '</select>' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-image"></i> Imagen (opcional)</label>' +
      '<input id="newImage" type="file" accept="image/*">' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-money-bill-wave"></i> Precio (COP)</label>' +
      '<input id="newPrice" type="number" min="0" step="1" value="10000" style="color:var(--success);font-weight:700">' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-copy"></i> Cantidad</label>' +
      '<input id="newQty" type="number" min="1" max="50" step="1" value="1">' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:20px">' +
      '<button id="confirmNew" class="btn" style="flex:1"><i class="fa-solid fa-check"></i> Agregar</button>' +
      '<button class="btn outline" onclick="closeModal()"><i class="fa-solid fa-xmark"></i> Cancelar</button>' +
    '</div>'
  show($('modal'))
  $('confirmNew').onclick = async function(){
    var n = $('newName').value.trim(); if(!n) return alert('Nombre requerido')
    var cat = $('newCategory').value
    var prefixes = {balones:'Pel. ',vestimenta:'',herramientas:'',cancha:''}
    if(!normalizeText(n).match(/(pelota|balon|futbol|basketball|baloncesto|voleibol|raqueta|tenis|bate|bicicleta|patines|patineta|jersey|uniforme|camiseta|pantalon|red|conos|arco|ski|natacion|golf)/)){
      var catHints = {balones:'Pelota ',vestimenta:'Jersey ',herramientas:'Raqueta ',cancha:''}
      n = catHints[cat] + n
    }
    var p = Number($('newPrice').value)
    if(!Number.isFinite(p) || p < 0) return alert('Precio inv\u00e1lido')
    var qty = Math.max(1, Math.min(50, parseInt($('newQty').value) || 1))
    var fileInp = $('newImage')
    var imageUrl = null
    if(fileInp && fileInp.files && fileInp.files.length>0){
      var fd = new FormData(); fd.append('file', fileInp.files[0])
      try{
        var upl = await fetch('/api/upload', {method:'POST', body: fd})
        var jr = await upl.json()
        if(jr && jr.ok) imageUrl = jr.url
      }catch(err){ console.warn('subida fallida', err) }
    }
    var ok = 0
    for(var i = 0; i < qty; i++){
      var res = await api('/api/items','POST',{name:n, image: imageUrl, price: p, condition: $('newCondition').value})
      if(res && res.ok) ok++
    }
    if(ok > 0){ await refreshData(); closeModal() }
  }
}

// --------------- TICKETS ---------------

function renderTickets(){
  var list = $('ticketsList'); if(!list) return
  var openEl = $('ticketsOpen'), progEl = $('ticketsInProgress'), closedEl = $('ticketsClosed')
  var open = state.tickets.filter(function(t){ return t.status === 'abierto' }).length
  var inProg = state.tickets.filter(function(t){ return t.status === 'en_proceso' }).length
  var closed = state.tickets.filter(function(t){ return t.status === 'cerrado' }).length
  if(openEl) openEl.textContent = open
  if(progEl) progEl.textContent = inProg
  if(closedEl) closedEl.textContent = closed

  var filtered = state.tickets
  if(state.ticketFilter && state.ticketFilter !== 'todos'){
    filtered = state.tickets.filter(function(t){ return t.status === state.ticketFilter })
  }

  list.innerHTML = ''
  if(filtered.length === 0){
    list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-file-lines"></i><p>No hay reportes para mostrar</p></div>'
    return
  }

  filtered.forEach(function(ticket){
    var row = document.createElement('div')
    row.className = 'ticket-row'
    var typeIcon = ticket.ticket_type === 'devolucion' ? 'fa-rotate-left' : ticket.ticket_type === 'mantenimiento' ? 'fa-wrench' : ticket.ticket_type === 'alquiler' ? 'fa-hand-holding-heart' : 'fa-flag'
    var typeLabel = ticket.ticket_type === 'devolucion' ? 'Devoluci\u00f3n' : ticket.ticket_type === 'mantenimiento' ? 'Mantenimiento' : ticket.ticket_type === 'alquiler' ? 'Alquiler' : 'Incidencia'
    var statusClass = 'ticket-status-' + ticket.status
    var statusLabel = ticket.status === 'abierto' ? 'Abierto' : ticket.status === 'en_proceso' ? 'En proceso' : 'Cerrado'
    var date = ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('es-CO') : ''

    row.innerHTML =
      '<div class="ticket-row-info">' +
        '<div class="ticket-row-header">' +
          '<span class="ticket-id">#' + ticket.id + '</span>' +
          '<span class="ticket-type-badge"><i class="fa-solid ' + typeIcon + '"></i> ' + typeLabel + '</span>' +
          '<span class="ticket-status-badge ' + statusClass + '">' + statusLabel + '</span>' +
        '</div>' +
        '<div class="ticket-row-name"><i class="fa-solid fa-box"></i> ' + ticket.item_name + '</div>' +
        '<div class="ticket-row-detail"><i class="fa-solid fa-clipboard"></i> ' + (ticket.description || 'Sin descripci\u00f3n') + '</div>' +
        '<div class="ticket-row-conditions">' +
          (ticket.condition_before ? '<span>Antes: <span class="condition-badge condition-' + ticket.condition_before + '">' + ticket.condition_before + '</span></span>' : '') +
          (ticket.condition_after ? '<span>Despu\u00e9s: <span class="condition-badge condition-' + ticket.condition_after + '">' + ticket.condition_after + '</span></span>' : '') +
        '</div>' +
        '<div class="ticket-row-meta">' +
          '<span><i class="fa-solid fa-user"></i> ' + (ticket.created_by || 'Sistema') + '</span>' +
          '<span><i class="fa-solid fa-calendar"></i> ' + date + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="ticket-row-actions">' +
        (ticket.status === 'abierto' ? '<button class="btn small ticket-progress-btn"><i class="fa-solid fa-spinner"></i> En proceso</button>' : '') +
        (ticket.status !== 'cerrado' ? '<button class="btn small outline ticket-close-btn" style="color:var(--success);border-color:var(--success)"><i class="fa-solid fa-circle-check"></i> Cerrar</button>' : '') +
        '<button class="btn small plain ticket-delete-btn" style="color:var(--danger)"><i class="fa-solid fa-trash"></i></button>' +
      '</div>'

    var progBtn = row.querySelector('.ticket-progress-btn')
    var closeBtn = row.querySelector('.ticket-close-btn')
    var deleteBtn = row.querySelector('.ticket-delete-btn')
    if(progBtn) progBtn.onclick = function(){ openTicketProcessModal(ticket, 'en_proceso') }
    if(closeBtn) closeBtn.onclick = function(){ openTicketProcessModal(ticket, 'cerrado') }
    if(deleteBtn) deleteBtn.onclick = function(){ if(confirm('¿Eliminar reporte #' + ticket.id + '?')) deleteTicket(ticket.id) }
    list.appendChild(row)
  })
}

function openTicketProcessModal(ticket, targetStatus){
  var item = state.inventory.find(function(i){ return i.id === ticket.item_id })
  var itemName = item ? item.name : (ticket.item_name || 'Producto')
  var currentCond = item ? (item.condition || 'bueno') : (ticket.condition_after || 'bueno')
  var currentItemStatus = item ? (item.status || 'disponible') : 'desconocido'
  var isClosing = targetStatus === 'cerrado'
  var isMaint = ticket.ticket_type === 'mantenimiento'
  var title = isClosing ? 'Cerrar Reporte #' + ticket.id : 'Procesar Reporte #' + ticket.id
  var titleIcon = isClosing ? 'fa-circle-check' : 'fa-spinner'

  var body = $('modalBody'); body.innerHTML = ''
  body.innerHTML =
    '<h3 style="margin-bottom:20px"><i class="fa-solid ' + titleIcon + '"></i> ' + title + '</h3>' +
    '<div class="ticket-row-header" style="margin-bottom:12px">' +
      '<span class="ticket-type-badge"><i class="fa-solid ' + (ticket.ticket_type === 'mantenimiento' ? 'fa-wrench' : ticket.ticket_type === 'devolucion' ? 'fa-rotate-left' : 'fa-flag') + '"></i> ' +
        (ticket.ticket_type === 'mantenimiento' ? 'Mantenimiento' : ticket.ticket_type === 'devolucion' ? 'Devoluci\u00f3n' : 'Incidencia') + '</span>' +
    '</div>' +
    '<div style="padding:10px 14px;background:var(--card);border-radius:var(--radius-sm);border:1px solid var(--muted-border);margin-bottom:16px">' +
      '<div><strong>' + itemName + '</strong></div>' +
      '<div style="margin-top:6px">Estado actual: <span class="condition-badge condition-' + currentCond + '">' + currentCond + '</span></div>' +
      '<div style="margin-top:4px">Disponibilidad: <strong>' + currentItemStatus + '</strong></div>' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-heart-pulse"></i> Actualizar estado f\u00edsico del producto</label>' +
      '<select id="procCondition">' +
        '<option value="bueno"' + (currentCond === 'bueno' ? ' selected' : '') + '>Bueno</option>' +
        '<option value="regular"' + (currentCond === 'regular' ? ' selected' : '') + '>Regular</option>' +
        '<option value="deterioro"' + (currentCond === 'deterioro' ? ' selected' : '') + '>Deterioro</option>' +
      '</select>' +
    '</div>' +
    (isMaint || isClosing ?
    '<div class="modal-form-group">' +
      '<label>Disponibilidad del producto</label>' +
      '<select id="procItemStatus">' +
        '<option value="mantenimiento"' + (currentItemStatus === 'mantenimiento' ? ' selected' : '') + '>En reparaci\u00f3n</option>' +
        '<option value="disponible"' + (currentItemStatus === 'disponible' ? ' selected' : '') + '>Disponible</option>' +
      '</select>' +
    '</div>' : '') +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-clipboard"></i> Notas de resoluci\u00f3n (opcional)</label>' +
      '<textarea id="procResolution" rows="2" placeholder="Describa lo que se hizo..." style="width:100%;padding:11px 14px;border-radius:var(--radius-sm);border:2px solid var(--muted-border);background:var(--bg);color:var(--text);font-family:inherit;font-size:0.95rem;resize:vertical"></textarea>' +
    '</div>' +
    '' +
    '<div style="display:flex;gap:8px;margin-top:20px">' +
      '<button id="confirmProcess" class="btn" style="flex:1"><i class="fa-solid fa-check"></i> ' + (isClosing ? 'Cerrar Reporte' : 'Marcar En Proceso') + '</button>' +
      '<button class="btn outline" onclick="closeModal()"><i class="fa-solid fa-xmark"></i> Cancelar</button>' +
    '</div>'
  show($('modal'))

  $('confirmProcess').onclick = async function(){
    var payload = { status: targetStatus }
    var newCond = $('procCondition').value
    if(newCond !== currentCond) payload.condition_after = newCond
    var statusSel = $('procItemStatus')
    var selectedItemStatus = currentItemStatus
    if(statusSel && statusSel.value) selectedItemStatus = statusSel.value
    // If closing the ticket, require the product to be marked as Disponible
    if(isClosing){
      if(selectedItemStatus !== 'disponible'){
        return alert('No puede cerrar el reporte si el producto no está marcado como Disponible. Cambie la Disponibilidad a "Disponible" para poder cerrar el reporte.')
      }
    }
    if(statusSel && statusSel.value) payload.item_status = statusSel.value
    var resolution = ($('procResolution').value || '').trim()
    if(resolution) payload.resolution = resolution
    var res = await api('/api/tickets/' + ticket.id + '/status', 'POST', payload)
    if(res && res.ok){ await refreshData(); closeModal() }
    else alert(res ? res.msg : 'Error al actualizar reporte')
  }
}

async function updateTicketStatus(ticketId, status){
  var res = await api('/api/tickets/' + ticketId + '/status', 'POST', {status: status})
  if(res && res.ok) await refreshData()
  else alert(res ? res.msg : 'Error al actualizar ticket')
}

async function deleteTicket(ticketId){
  var res = await api('/api/tickets/' + ticketId, 'DELETE')
  if(res && res.ok) await refreshData()
  else alert(res ? res.msg : 'Error al eliminar ticket')
}

function openNewTicketModal(){
  var body = $('modalBody'); body.innerHTML = ''
  var itemOptions = state.inventory.map(function(item){
    return '<option value="' + item.id + '">' + item.name + ' (' + (item.condition || 'bueno') + ')</option>'
  }).join('')
  body.innerHTML =
    '<h3 style="margin-bottom:20px"><i class="fa-solid fa-file-lines"></i> Nuevo Reporte</h3>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-box"></i> Art\u00edculo</label>' +
      '<select id="ticketItem">' + itemOptions + '</select>' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-flag"></i> Tipo</label>' +
      '<select id="ticketType">' +
        '<option value="incidencia">Incidencia</option>' +
        '<option value="devolucion">Devoluci\u00f3n</option>' +
        '<option value="mantenimiento">Mantenimiento</option>' +
        '<option value="alquiler">Alquiler</option>' +
      '</select>' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-heart-pulse"></i> Estado actual del producto</label>' +
      '<select id="ticketCondBefore">' +
        '<option value="bueno">Bueno</option>' +
        '<option value="regular">Regular</option>' +
        '<option value="deterioro">Deterioro</option>' +
      '</select>' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-heart-circle-check"></i> Estado reportado</label>' +
      '<select id="ticketCondAfter">' +
        '<option value="bueno">Bueno</option>' +
        '<option value="regular">Regular</option>' +
        '<option value="deterioro">Deterioro</option>' +
      '</select>' +
    '</div>' +
    '<div class="modal-form-group">' +
      '<label><i class="fa-solid fa-clipboard"></i> Descripci\u00f3n</label>' +
      '<textarea id="ticketDesc" rows="3" placeholder="Describa la incidencia o estado del producto..." style="width:100%;padding:11px 14px;border-radius:var(--radius-sm);border:2px solid var(--muted-border);background:var(--bg);color:var(--text);font-family:inherit;font-size:0.95rem;resize:vertical"></textarea>' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:20px">' +
      '<button id="confirmTicket" class="btn" style="flex:1"><i class="fa-solid fa-check"></i> Crear Reporte</button>' +
      '<button class="btn outline" onclick="closeModal()"><i class="fa-solid fa-xmark"></i> Cancelar</button>' +
    '</div>'
  show($('modal'))
  // Auto-select condition based on selected item
  $('ticketItem').onchange = function(){
    var selectedItem = state.inventory.find(function(i){ return i.id === Number($('ticketItem').value) })
    if(selectedItem && $('ticketCondBefore')) $('ticketCondBefore').value = selectedItem.condition || 'bueno'
  }
  // trigger initial
  var firstItem = state.inventory.find(function(i){ return i.id === Number($('ticketItem').value) })
  if(firstItem && $('ticketCondBefore')) $('ticketCondBefore').value = firstItem.condition || 'bueno'

  $('confirmTicket').onclick = async function(){
    var itemId = Number($('ticketItem').value)
    var type = $('ticketType').value
    var condBefore = $('ticketCondBefore').value
    var condAfter = $('ticketCondAfter').value
    var desc = ($('ticketDesc').value || '').trim()
    if(!desc) return alert('Ingresa una descripci\u00f3n')
    var res = await api('/api/tickets', 'POST', {
      item_id: itemId, ticket_type: type,
      condition_before: condBefore, condition_after: condAfter,
      description: desc
    })
    if(res && res.ok){ await refreshData(); closeModal() }
    else alert(res ? res.msg : 'Error al crear ticket')
  }
}

// --------------- REPORTES ---------------

function renderReports(){
  const total = state.inventory.length
  const available = state.inventory.filter(function(i){ return i.status === 'disponible' }).length
  const rented = state.inventory.filter(function(i){ return i.status === 'alquilado' }).length
  const maintenance = state.inventory.filter(function(i){ return i.status === 'mantenimiento' }).length

  var te = $('totalItems'); if(te) te.textContent = total
  var ae = $('availableItems'); if(ae) ae.textContent = available
  var re = $('rentedItems'); if(re) re.textContent = rented
  var me2 = $('maintenanceItems'); if(me2) me2.textContent = maintenance

  var ctxStatus = document.getElementById('chartStatus')
  if(ctxStatus && window.statusChart) window.statusChart.destroy()
  if(ctxStatus) window.statusChart = new Chart(ctxStatus, {
    type: 'doughnut',
    data: {
      labels: ['Disponible', 'Alquilado', 'Mantenimiento'],
      datasets: [{ data: [available, rented, maintenance], backgroundColor: ['#10b981', '#ef4444', '#f59e0b'], borderWidth: 0 }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } } } }
  })

  var occupancyPercent = total > 0 ? Math.round((rented / total) * 100) : 0
  var ctxOccupancy = document.getElementById('chartOccupancy')
  if(ctxOccupancy && window.occupancyChart) window.occupancyChart.destroy()
  if(ctxOccupancy) window.occupancyChart = new Chart(ctxOccupancy, {
    type: 'doughnut',
    data: {
      labels: ['En uso', 'Libre'],
      datasets: [{ data: [occupancyPercent, 100 - occupancyPercent], backgroundColor: ['#ff6b35', '#e2e8f0'], borderWidth: 0 }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } }, tooltip: { callbacks: { label: function(ctx){ return ctx.label + ': ' + ctx.parsed + '%' } } } } }
  })

  var nombres = state.inventory.map(function(i){ return i.name })
  var estatus = state.inventory.map(function(i){ if(i.status === 'disponible') return 0; if(i.status === 'alquilado') return 1; return 2 })
  var ctx = document.getElementById('chartTop')
  if(ctx && window.topChart) window.topChart.destroy()
  if(ctx) window.topChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: nombres,
      datasets: [{ label: 'Estado', data: estatus,
        backgroundColor: estatus.map(function(e){ return e===0?'#10b981':e===1?'#ef4444':'#f59e0b' }),
        borderRadius: 6, borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y', responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { callback: function(v){ return v===0?'Disponible':v===1?'Alquilado':'Mantenimiento' } } } }
    }
  })
}

function toggleTheme(){
  document.body.classList.toggle('dark')
  var isDark = document.body.classList.contains('dark')
  var btn = $('toggleTheme')
  if(btn) btn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i> Modo claro' : '<i class="fa-solid fa-moon"></i> Modo oscuro'
  localStorage.setItem('dsp_theme', isDark ? 'dark' : 'light')
}

// Restore saved theme
;(function(){
  var saved = localStorage.getItem('dsp_theme')
  if(saved === 'dark') document.body.classList.add('dark')
  var btn = $('toggleTheme')
  if(btn) btn.innerHTML = saved === 'dark' ? '<i class="fa-solid fa-sun"></i> Modo claro' : '<i class="fa-solid fa-moon"></i> Modo oscuro'
})()

// Init for non-dashboard pages
if(!window.location.pathname.endsWith('dashboard.html')){
  initUI()
}
