import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function Admin() {
  const [tab, setTab] = useState('orders')
  const [orders, setOrders] = useState([])
  const [subs, setSubs] = useState([])
  const [users, setUsers] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const token = sessionStorage.getItem('adminToken')

  if (!token) navigate('/admin-login')

  function apiFetch(url, opts = {}) {
    return fetch(url, { ...opts, headers: { ...(opts.headers || {}), 'x-admin-token': token } })
  }

  async function loadOrders() {
    setLoading(true)
    const res = await apiFetch('/api/admin/orders')
    if (res.status === 401) { navigate('/admin-login'); return }
    setOrders(await res.json())
    setLoading(false)
  }

  async function loadSubs() {
    const res = await apiFetch('/api/admin/subscriptions')
    setSubs(await res.json())
  }

  async function loadUsers() {
    const res = await apiFetch('/api/admin/users')
    setUsers(await res.json())
  }

  useEffect(() => { loadOrders() }, [])

  async function updateStatus(id, status) {
    await apiFetch(`/api/admin/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    loadOrders()
  }

  async function deleteOrder(id) {
    if (!confirm('Delete this order?')) return
    await apiFetch(`/api/admin/orders/${id}`, { method: 'DELETE' })
    loadOrders()
  }

  async function cancelSub(id) {
    if (!confirm('Cancel this subscription?')) return
    await apiFetch(`/api/admin/subscriptions/${id}`, { method: 'DELETE' })
    loadSubs()
  }

  async function deleteUser(id) {
    if (!confirm('Delete this user and all their data?')) return
    await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    loadUsers()
  }

  function filterOrders() {
    const now = new Date()
    return orders.filter(o => {
      const d = new Date(o.createdAt)
      if (filter === 'weekly') { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w }
      if (filter === 'monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      if (filter === 'yearly') return d.getFullYear() === now.getFullYear()
      return true
    })
  }

  const filtered = filterOrders()
  const totalSales = filtered.reduce((s, o) => s + (o.totalPrice || 0), 0)

  function switchTab(t) {
    setTab(t)
    if (t === 'subscriptions') loadSubs()
    if (t === 'users') loadUsers()
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <nav className="bg-white shadow px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <i className="fas fa-print text-primary text-2xl"></i>
          <span className="text-xl font-bold text-primary">StudentPrint</span>
          <span className="ml-2 text-sm bg-blue-100 text-primary px-2 py-0.5 rounded font-semibold">Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="text-sm text-gray-500 hover:text-primary"><i className="fas fa-arrow-left mr-1"></i>Back to Site</a>
          <button onClick={() => { sessionStorage.removeItem('adminToken'); navigate('/admin-login') }}
            className="text-sm text-red-500 hover:text-red-700 font-medium">
            <i className="fas fa-sign-out-alt mr-1"></i>Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['orders', 'subscriptions', 'users'].map(t => (
            <button key={t} onClick={() => switchTab(t)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm capitalize ${tab === t ? 'bg-primary text-white' : 'bg-white text-gray-600 border'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Stats */}
        {tab === 'orders' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Orders', val: filtered.length, color: 'text-primary' },
              { label: 'Pending', val: filtered.filter(o => o.status === 'pending').length, color: 'text-yellow-500' },
              { label: 'Processing', val: filtered.filter(o => o.status === 'processing').length, color: 'text-blue-500' },
              { label: 'Delivered', val: filtered.filter(o => o.status === 'delivered').length, color: 'text-green-500' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl p-4 shadow text-center">
                <p className={`text-3xl font-bold ${s.color}`}>{s.val}</p>
                <p className="text-gray-500 text-sm mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Orders */}
        {tab === 'orders' && (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b gap-3">
              <h2 className="text-lg font-bold text-gray-800">All Orders</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm">
                  {['all', 'weekly', 'monthly', 'yearly'].map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`px-3 py-1.5 capitalize ${filter === f ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                      {f}
                    </button>
                  ))}
                </div>
                {filtered.length > 0 && <span className="text-sm font-semibold text-green-600">Sales: ₹{totalSales.toFixed(2)}</span>}
                <button onClick={loadOrders} className="text-sm text-primary hover:underline"><i className="fas fa-sync mr-1"></i>Refresh</button>
              </div>
            </div>
            {loading ? (
              <div className="text-center py-12 text-gray-400"><i className="fas fa-spinner fa-spin text-2xl"></i><p className="mt-2">Loading...</p></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400"><i className="fas fa-inbox text-4xl mb-2"></i><p>No orders yet.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                    <tr>
                      {['#', 'Customer', 'File', 'Copies', 'Pages', 'Print', 'Total', 'Package', 'Binding', 'Delivery', 'Payment', 'UPI ID', 'Status', 'Placed At', 'Action'].map(h => (
                        <th key={h} className="px-4 py-3 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((o, i) => (
                      <tr key={o._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{o.user?.name || 'Unknown'}</p>
                          <p className="text-gray-400 text-xs">{o.user?.email || ''}</p>
                        </td>
                        <td className="px-4 py-3">
                          {o.fileName
                            ? <a href={`/uploads/${o.fileName}`} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs"><i className="fas fa-file-pdf mr-1"></i>{o.fileName}</a>
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{o.copies}</td>
                        <td className="px-4 py-3 text-gray-700">{o.pages || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${o.printType === 'colour' ? 'bg-pink-100 text-pink-700' : o.printType === 'mixed' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                            {o.printType === 'bw' ? 'B&W' : o.printType === 'colour' ? 'Colour' : 'Mixed'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-primary">{o.totalPrice ? `₹${o.totalPrice.toFixed(2)}` : '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{o.packageType || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {o.softBinding && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs mr-1">Soft</span>}
                          {o.spiralBinding && <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs">Spiral</span>}
                          {!o.softBinding && !o.spiralBinding && <span className="text-gray-400">None</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-700 text-xs">{o.deliveryDate || '—'}<br />{o.deliveryTime || ''}</td>
                        <td className="px-4 py-3 text-gray-700">{o.paymentMethod || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{o.upiId || '—'}</td>
                        <td className="px-4 py-3">
                          <select value={o.status} onChange={e => updateStatus(o._id, e.target.value)}
                            className={`text-xs px-2 py-1 rounded-full border-0 font-semibold cursor-pointer ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>
                            {['pending', 'processing', 'delivered', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{new Date(o.createdAt).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => deleteOrder(o._id)} className="text-red-500 hover:text-red-700 text-xs font-medium">
                            <i className="fas fa-trash mr-1"></i>Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Subscriptions */}
        {tab === 'subscriptions' && (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">All Subscriptions</h2>
              <button onClick={loadSubs} className="text-sm text-primary hover:underline"><i className="fas fa-sync mr-1"></i>Refresh</button>
            </div>
            {subs.length === 0 ? (
              <div className="text-center py-12 text-gray-400"><i className="fas fa-inbox text-4xl mb-2"></i><p>No subscriptions yet.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                    <tr>{['#', 'Customer', 'Plan', 'Pages Allowed', 'Pages Used', 'Remaining', 'Start', 'Expiry', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {subs.map((s, i) => {
                      const active = new Date(s.endDate) > new Date()
                      return (
                        <tr key={s._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                          <td className="px-4 py-3"><p className="font-medium">{s.user?.name || 'Unknown'}</p><p className="text-gray-400 text-xs">{s.user?.email}</p></td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-semibold text-primary">{s.plan}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{s.pagesAllowed}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{s.pagesUsed}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">{s.pagesAllowed - s.pagesUsed}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{new Date(s.startDate).toLocaleDateString('en-IN')}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{new Date(s.endDate).toLocaleDateString('en-IN')}</td>
                          <td className="px-4 py-3">
                            {active
                              ? <><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">Active</span>
                                  <button onClick={() => cancelSub(s._id)} className="ml-2 text-xs text-red-500 hover:text-red-700">Cancel</button></>
                              : <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-xs">Expired</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Users */}
        {tab === 'users' && (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">All Users</h2>
              <button onClick={loadUsers} className="text-sm text-primary hover:underline"><i className="fas fa-sync mr-1"></i>Refresh</button>
            </div>
            {users.length === 0 ? (
              <div className="text-center py-12 text-gray-400"><i className="fas fa-users text-4xl mb-2"></i><p>No users yet.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                    <tr>{['#', 'Name', 'Email', 'Orders', 'Active Plan', 'Joined', 'Action'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map((u, i) => (
                      <tr key={u._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{u.name}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{u.email}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{u.orderCount}</td>
                        <td className="px-4 py-3">
                          {u.activeSub
                            ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">{u.activeSub.plan}</span>
                            : <span className="text-gray-400 text-xs">None</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => deleteUser(u._id)} className="text-red-500 hover:text-red-700 text-xs font-medium">
                            <i className="fas fa-trash mr-1"></i>Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
