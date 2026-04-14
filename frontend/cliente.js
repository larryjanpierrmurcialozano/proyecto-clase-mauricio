/* Cliente – DropSport Ecommerce View */
var cState = { user: null, inventory: [], myTickets: [], myRentals: [], view: 'catalog', search: '', category: 'todos' }

function $(id){ return document.getElementById(id) }
function show(el){ el.classList.remove('hidden') }
function hide(el){ el.classList.add('hidden') }
function formatCOP(v){ return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(v||0)) }

var categoryMap = {
  'pelota':'balones','futbol':'balones','balón':'balones','basketball':'balones','baloncesto':'balones',
  'raqueta':'herramientas','bate':'herramientas','remo':'herramientas',
  'uniforme':'vestimenta','jersey':'vestimenta','remera':'vestimenta','camiseta':'vestimenta','pantalón':'vestimenta',
  'bicicleta':'cancha','patinete':'cancha','patines':'cancha','arco':'cancha','red':'cancha','conos':'cancha','cancha':'cancha'
}
var sportIcons = {
  'pelota':'fa-futbol','futbol':'fa-futbol','balon':'fa-futbol',
  'basketball':'fa-basketball','baloncesto':'fa-basketball',
  'voleibol':'fa-volleyball','raqueta':'fa-table-tennis-paddle-ball','tenis':'fa-table-tennis-paddle-ball',
  'bicicleta':'fa-bicycle','patines':'fa-shoe-prints',
  'jersey':'fa-shirt','uniforme':'fa-shirt','camiseta':'fa-shirt',
  'conos':'fa-road','arco':'fa-bullseye','red':'fa-table-tennis-paddle-ball'
}
function getCategory(name){
  var lower = (name||'').toLowerCase()
  for(var k in categoryMap) if(lower.indexOf(k)!==-1) return categoryMap[k]
  return 'cancha'
}
function getIcon(name){
  var lower = (name||'').toLowerCase()
  for(var k in sportIcons) if(lower.indexOf(k)!==-1) return sportIcons[k]
  return 'fa-dumbbell'
}

async function api(path, method, body){
  var opts = { method: method||'GET', headers: {} }
  var token = localStorage.getItem('dsp_token')
  if(token) opts.headers['Authorization'] = 'Bearer ' + token
  if(body){ opts.headers['Content-Type']='application/json'; opts.body = JSON.stringify(body) }
  try {
    var res = await fetch(path, opts)
    if(res.headers.get('content-type') && res.headers.get('content-type').indexOf('application/json')!==-1) return res.json()
  } catch(e){ console.error(e) }
  return null
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', async function(){
  // Check auth
  var me = await api('/api/me')
  if(!me || !me.ok){ location.href = 'login.html'; return }
  cState.user = me.user
  // If admin or empleado, redirect to dashboard
  if(cState.user.role === 'administrador' || cState.user.role === 'empleado'){
    location.href = 'dashboard.html'; return
  }
  setupUI()
  await refreshData()
  renderAll()
})

function setupUI(){
  // User info
  $('userName').textContent = cState.user.name
  $('userAvatar').textContent = (cState.user.name||'U').charAt(0).toUpperCase()

  // Logout
  $('clientLogout').onclick = function(){ localStorage.removeItem('dsp_token'); location.href = 'login.html' }

  // Theme
  var savedTheme = localStorage.getItem('theme')
  if(savedTheme === 'dark') document.body.classList.add('dark')
  $('clientTheme').onclick = function(){
    document.body.classList.toggle('dark')
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light')
  }

  // Navigation
  document.querySelectorAll('.client-nav-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.client-nav-btn').forEach(function(b){ b.classList.remove('active') })
      btn.classList.add('active')
      switchView(btn.dataset.view)
    })
  })

  // Search
  $('clientSearch').oninput = function(e){
    cState.search = (e.target.value||'').toLowerCase()
    renderCatalog()
  }

  // Modal close
  $('clientModalClose').onclick = closeModal
  $('clientModal').onclick = function(e){ if(e.target === $('clientModal')) closeModal() }
}

function switchView(view){
  cState.view = view
  hide($('catalogView'))
  hide($('myRentalsView'))
  hide($('myTicketsView'))
  if(view === 'catalog') show($('catalogView'))
  else if(view === 'myrentals'){ show($('myRentalsView')); renderMyRentals() }
  else if(view === 'mytickets'){ show($('myTicketsView')); renderMyTickets() }
}

async function refreshData(){
  var inv = await api('/api/inventory')
  if(Array.isArray(inv)) cState.inventory = inv

  var tickets = await api('/api/my-tickets')
  if(tickets && Array.isArray(tickets)) cState.myTickets = tickets

  var rentals = await api('/api/my-rentals')
  if(rentals && Array.isArray(rentals)) cState.myRentals = rentals
}

function renderAll(){
  renderCatFilters()
  renderCatalog()
}

function closeModal(){
  hide($('clientModal'))
  $('clientModalBody').innerHTML = ''
}
function openModal(){
  show($('clientModal'))
}

/* ===== CATALOG ===== */
function renderCatFilters(){
  var container = $('catFilters')
  var cats = [
    {key:'todos', label:'Todos', icon:'fa-grip'},
    {key:'balones', label:'Balones', icon:'fa-futbol'},
    {key:'vestimenta', label:'Vestimenta', icon:'fa-shirt'},
    {key:'herramientas', label:'Herramientas', icon:'fa-screwdriver-wrench'},
    {key:'cancha', label:'Cancha', icon:'fa-flag'}
  ]
  container.innerHTML = ''
  cats.forEach(function(c){
    var chip = document.createElement('button')
    chip.className = 'cat-chip' + (cState.category === c.key ? ' active' : '')
    chip.innerHTML = '<i class="fa-solid ' + c.icon + '"></i> ' + c.label
    chip.onclick = function(){
      cState.category = c.key
      document.querySelectorAll('.cat-chip').forEach(function(ch){ ch.classList.remove('active') })
      chip.classList.add('active')
      renderCatalog()
    }
    container.appendChild(chip)
  })
}

function renderCatalog(){
  var grid = $('productGrid')
  grid.innerHTML = ''

  var items = cState.inventory.filter(function(item){
    // Hide eliminated items
    if(item.status === 'eliminado') return false
    // Category filter
    if(cState.category !== 'todos' && getCategory(item.name) !== cState.category) return false
    // Search filter
    if(cState.search && item.name.toLowerCase().indexOf(cState.search) === -1) return false
    return true
  })

  if(items.length === 0){
    grid.innerHTML = '<div class="empty-msg" style="grid-column:1/-1"><i class="fa-solid fa-box-open"></i><p>No hay productos disponibles en esta categoría</p></div>'
    return
  }

  items.forEach(function(item){
    var card = document.createElement('div')
    card.className = 'product-card'
    var icon = getIcon(item.name)
    var cat = getCategory(item.name)
    var catLabel = cat.charAt(0).toUpperCase() + cat.slice(1)
    var isAvailable = item.status === 'disponible'
    var statusLabel = item.status === 'disponible' ? 'Disponible' : item.status === 'alquilado' ? 'Alquilado' : 'Mantenimiento'
    var imgHtml = item.image
      ? '<img src="' + item.image + '" alt="' + item.name + '">'
      : '<div class="placeholder-icon"><i class="fa-solid ' + icon + '"></i></div>'

    card.innerHTML =
      '<div class="product-card-img">' +
        imgHtml +
        '<span class="product-card-status ' + item.status + '">' + statusLabel + '</span>' +
      '</div>' +
      '<div class="product-card-body">' +
        '<div class="product-card-name"><i class="fa-solid ' + icon + '"></i> ' + item.name + '</div>' +
        '<div class="product-card-cat"><i class="fa-solid fa-tag"></i> ' + catLabel + '</div>' +
        '<div class="product-card-meta">' +
          '<span class="condition-badge condition-' + (item.condition||'bueno') + '"><i class="fa-solid fa-heart-pulse"></i> ' + (item.condition||'bueno') + '</span>' +
        '</div>' +
        '<div class="product-card-price">' + formatCOP(item.price||10000) + ' <small>/ día</small></div>' +
        '<div class="product-card-actions" style="margin-top:12px">' +
          (isAvailable
            ? '<button class="btn btn-rent rent-btn"><i class="fa-solid fa-hand-holding-heart"></i> Solicitar Alquiler</button>'
            : '<button class="btn btn-unavailable" disabled><i class="fa-solid fa-clock"></i> No disponible</button>') +
        '</div>' +
      '</div>'

    if(isAvailable){
      card.querySelector('.rent-btn').onclick = function(){ openRentalModal(item) }
    }
    grid.appendChild(card)
  })
}

/* ===== RENTAL MODAL ===== */
function openRentalModal(item){
  var body = $('clientModalBody')
  var icon = getIcon(item.name)
  var today = new Date().toISOString().split('T')[0]

  body.innerHTML =
    '<h3><i class="fa-solid fa-hand-holding-heart"></i> Solicitar Alquiler</h3>' +
    '<div style="display:flex;align-items:center;gap:12px;padding:14px;background:var(--bg);border-radius:var(--radius-sm);margin-bottom:18px">' +
      '<div style="font-size:2rem;color:var(--primary)"><i class="fa-solid ' + icon + '"></i></div>' +
      '<div>' +
        '<div style="font-weight:700">' + item.name + '</div>' +
        '<div style="color:var(--muted);font-size:0.85rem">' + formatCOP(item.price||10000) + ' / día</div>' +
      '</div>' +
    '</div>' +
    '<div class="form-group">' +
      '<label><i class="fa-solid fa-id-card"></i> Documento de identidad</label>' +
      '<input id="rentDoc" placeholder="Cédula o documento">' +
    '</div>' +
    '<div class="form-group">' +
      '<label><i class="fa-solid fa-phone"></i> Teléfono de contacto</label>' +
      '<input id="rentPhone" placeholder="Ej: 320 296 4025">' +
    '</div>' +
    '<div class="form-group">' +
      '<label><i class="fa-solid fa-calendar"></i> Fecha inicio</label>' +
      '<input id="rentFrom" type="date" value="' + today + '">' +
    '</div>' +
    '<div class="form-group">' +
      '<label><i class="fa-solid fa-calendar-check"></i> Fecha fin</label>' +
      '<input id="rentTo" type="date">' +
    '</div>' +
    '<div class="form-group">' +
      '<label><i class="fa-solid fa-clipboard"></i> Notas adicionales (opcional)</label>' +
      '<textarea id="rentNotes" rows="2" placeholder="Ej: Necesito para torneo de sábado..."></textarea>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button id="confirmRent" class="btn btn-rent"><i class="fa-solid fa-check"></i> Solicitar</button>' +
      '<button class="btn outline" onclick="closeModal()"><i class="fa-solid fa-xmark"></i> Cancelar</button>' +
    '</div>'
  openModal()

  $('confirmRent').onclick = async function(){
    var doc = ($('rentDoc').value||'').trim()
    var phone = ($('rentPhone').value||'').trim()
    var from = $('rentFrom').value
    var to = $('rentTo').value
    var notes = ($('rentNotes').value||'').trim()
    if(!doc) return alert('Ingrese su documento de identidad')
    if(!from || !to) return alert('Seleccione las fechas de alquiler')
    if(new Date(to) < new Date(from)) return alert('La fecha fin debe ser posterior a la fecha inicio')

    var res = await api('/api/rental-request','POST',{
      item_id: item.id,
      document: doc,
      phone: phone,
      start_date: from,
      end_date: to,
      notes: notes
    })
    if(res && res.ok){
      alert('¡Solicitud enviada! Se creó el ticket #' + res.ticket.id + '. Puedes seguir su estado en "Mis Tickets".')
      await refreshData()
      renderCatalog()
      closeModal()
    } else {
      alert(res ? res.msg : 'Error al enviar la solicitud')
    }
  }
}

/* ===== MY RENTALS ===== */
function renderMyRentals(){
  var list = $('rentalList')
  var stats = $('rentalStats')
  var rentals = cState.myRentals

  var active = rentals.filter(function(r){ return r.status === 'activo' }).length
  var completed = rentals.filter(function(r){ return r.status === 'completado' }).length
  var pending = rentals.filter(function(r){ return r.status === 'pendiente' }).length

  stats.innerHTML =
    '<div class="client-stat-card"><div class="stat-number">' + pending + '</div><div class="stat-label"><i class="fa-solid fa-clock"></i> Pendientes</div></div>' +
    '<div class="client-stat-card"><div class="stat-number">' + active + '</div><div class="stat-label"><i class="fa-solid fa-hand-holding-heart"></i> Activos</div></div>' +
    '<div class="client-stat-card"><div class="stat-number">' + completed + '</div><div class="stat-label"><i class="fa-solid fa-circle-check"></i> Completados</div></div>'

  list.innerHTML = ''
  if(rentals.length === 0){
    list.innerHTML = '<div class="empty-msg"><i class="fa-solid fa-hand-holding-heart"></i><p>Aún no tienes alquileres. Explora el catálogo para solicitar uno.</p></div>'
    return
  }

  rentals.forEach(function(r){
    var card = document.createElement('div')
    card.className = 'rental-card'
    var statusClass = r.status === 'activo' ? 'disponible' : r.status === 'pendiente' ? 'alquilado' : 'mantenimiento'
    var statusLabel = r.status === 'activo' ? 'Activo' : r.status === 'pendiente' ? 'Pendiente' : 'Completado'

    card.innerHTML =
      '<div class="rental-card-info">' +
        '<div class="rental-card-name"><i class="fa-solid ' + getIcon(r.item_name) + '"></i> ' + r.item_name + '</div>' +
        '<div class="rental-card-detail"><i class="fa-solid fa-calendar"></i> ' + r.start_date + ' → ' + r.end_date + '</div>' +
        '<div class="rental-card-detail"><i class="fa-solid fa-money-bill-wave"></i> ' + formatCOP(r.price) + '</div>' +
      '</div>' +
      '<div class="rental-card-status">' +
        '<span class="badge ' + statusClass + '">' + statusLabel + '</span>' +
      '</div>'
    list.appendChild(card)
  })
}

/* ===== MY TICKETS ===== */
function renderMyTickets(){
  var list = $('userTicketList')
  var stats = $('ticketStats')
  var tickets = cState.myTickets

  var open = tickets.filter(function(t){ return t.status === 'abierto' }).length
  var inProg = tickets.filter(function(t){ return t.status === 'en_proceso' }).length
  var closed = tickets.filter(function(t){ return t.status === 'cerrado' }).length

  stats.innerHTML =
    '<div class="client-stat-card"><div class="stat-number">' + open + '</div><div class="stat-label"><i class="fa-solid fa-folder-open"></i> Abiertos</div></div>' +
    '<div class="client-stat-card"><div class="stat-number">' + inProg + '</div><div class="stat-label"><i class="fa-solid fa-spinner"></i> En proceso</div></div>' +
    '<div class="client-stat-card"><div class="stat-number">' + closed + '</div><div class="stat-label"><i class="fa-solid fa-circle-check"></i> Cerrados</div></div>'

  list.innerHTML = ''
  if(tickets.length === 0){
    list.innerHTML = '<div class="empty-msg"><i class="fa-solid fa-ticket"></i><p>No tienes tickets aún. Solicita un alquiler para crear uno.</p></div>'
    return
  }

  tickets.forEach(function(t){
    var card = document.createElement('div')
    card.className = 'user-ticket-card status-' + t.status
    var typeIcon = t.ticket_type === 'alquiler' ? 'fa-hand-holding-heart' : t.ticket_type === 'devolucion' ? 'fa-rotate-left' : t.ticket_type === 'mantenimiento' ? 'fa-wrench' : 'fa-flag'
    var typeLabel = t.ticket_type === 'alquiler' ? 'Alquiler' : t.ticket_type === 'devolucion' ? 'Devolución' : t.ticket_type === 'mantenimiento' ? 'Mantenimiento' : 'Incidencia'
    var statusLabel = t.status === 'abierto' ? 'Abierto' : t.status === 'en_proceso' ? 'En proceso' : 'Cerrado'
    var date = t.created_at ? new Date(t.created_at).toLocaleDateString('es-CO') : ''

    card.innerHTML =
      '<div class="user-ticket-header">' +
        '<span class="ticket-id">#' + t.id + '</span>' +
        '<span class="ticket-type-badge"><i class="fa-solid ' + typeIcon + '"></i> ' + typeLabel + '</span>' +
        '<span class="ticket-status-badge ticket-status-' + t.status + '">' + statusLabel + '</span>' +
      '</div>' +
      '<div style="margin-bottom:6px"><i class="fa-solid fa-box"></i> ' + (t.item_name||'Producto') + '</div>' +
      '<div style="color:var(--muted);font-size:0.9rem;margin-bottom:6px"><i class="fa-solid fa-clipboard"></i> ' + (t.description||'Sin descripción') + '</div>' +
      (t.condition_before || t.condition_after ?
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:6px">' +
          (t.condition_before ? '<span>Antes: <span class="condition-badge condition-' + t.condition_before + '">' + t.condition_before + '</span></span>' : '') +
          (t.condition_after ? '<span>Después: <span class="condition-badge condition-' + t.condition_after + '">' + t.condition_after + '</span></span>' : '') +
        '</div>' : '') +
      '<div style="font-size:0.8rem;color:var(--muted)"><i class="fa-solid fa-calendar"></i> ' + date + '</div>'
    list.appendChild(card)
  })
}
