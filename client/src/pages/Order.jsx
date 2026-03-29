import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

const RATES = { 'One-time': 2, 'Monthly': 1.5, 'Quarterly': 1.2, 'Half-Yearly': 1, 'Yearly': 0.8 }
const COLOUR_EXTRA = 5
const PAYMENT_METHODS = [
  { method: 'UPI', icon: 'fa-mobile-alt', placeholder: 'yourname@upi' },
  { method: 'Paytm', icon: 'fa-wallet', placeholder: '9876543210@paytm' },
  { method: 'PhonePe', icon: 'fa-phone', placeholder: '9876543210@ybl' },
  { method: 'Google Pay', icon: 'fa-google', placeholder: '9876543210@okaxis' },
]

export default function Order() {
  const navigate = useNavigate()
  const fileRef = useRef()
  const [detectedPages, setDetectedPages] = useState(0)
  const [copies, setCopies] = useState(1)
  const [packageType, setPackageType] = useState('One-time')
  const [binding, setBinding] = useState('none')
  const [printType, setPrintType] = useState('bw')
  const [pageTypes, setPageTypes] = useState([])
  const [selectedPayment, setSelectedPayment] = useState('')
  const [upiId, setUpiId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('')
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const MERCHANT_UPI = "itshitanshu@okaxis" // Change this to your actual UPI ID

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.type === 'application/pdf') {
      const buf = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise
      setDetectedPages(pdf.numPages)
      setPageTypes(Array(pdf.numPages).fill('bw'))
    } else {
      setDetectedPages(0)
    }
  }

  function togglePageType(i) {
    const updated = [...pageTypes]
    updated[i] = updated[i] === 'bw' ? 'colour' : 'bw'
    setPageTypes(updated)
  }

  function calcPrice() {
    if (!detectedPages) return null
    const baseRate = RATES[packageType] || 2
    const bindingCost = binding === 'soft' ? 10 : binding === 'spiral' ? 20 : 0
    let printCost = 0, bwPages = 0, colourPages = 0
    if (printType === 'mixed') {
      bwPages = pageTypes.filter(t => t === 'bw').length
      colourPages = pageTypes.filter(t => t === 'colour').length
      printCost = (bwPages * baseRate + colourPages * (baseRate + COLOUR_EXTRA)) * copies
    } else if (printType === 'colour') {
      colourPages = detectedPages
      printCost = detectedPages * copies * (baseRate + COLOUR_EXTRA)
    } else {
      bwPages = detectedPages
      printCost = detectedPages * copies * baseRate
    }
    return { printCost, bindingCost, total: printCost + bindingCost, bwPages, colourPages, baseRate }
  }

  const price = calcPrice()

  async function handleSubmit(e) {
    e.preventDefault()
    const token = localStorage.getItem('token')
    if (!token) { alert('Please login to place an order.'); navigate('/login'); return }
    if (!fileRef.current?.files[0]) { alert('Please upload a file.'); return }
    if (!detectedPages) { alert('Could not detect pages. Please upload a valid PDF.'); return }
    setSubmitting(true)
    const formData = new FormData()
    formData.append('file', fileRef.current.files[0])
    formData.append('copies', copies)
    formData.append('packageType', packageType)
    formData.append('printType', printType)
    formData.append('pages', detectedPages)
    formData.append('softBinding', binding === 'soft')
    formData.append('spiralBinding', binding === 'spiral')
    formData.append('deliveryDate', deliveryDate)
    formData.append('deliveryTime', deliveryTime)
    formData.append('paymentMethod', selectedPayment || 'UPI')
    formData.append('upiId', upiId)
    formData.append('totalPrice', price?.total || 0)
    formData.append('bwPages', printType === 'mixed' ? pageTypes.filter(t => t === 'bw').length : printType === 'bw' ? detectedPages : 0)
    formData.append('colourPages', printType === 'mixed' ? pageTypes.filter(t => t === 'colour').length : printType === 'colour' ? detectedPages : 0)
    const res = await fetch('/api/orders', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: formData })
    const data = await res.json()
    if (res.ok) {
      setOrderSuccess(true)
    } else {
      alert(data.message)
    }
    setSubmitting(false)
  }

  if (orderSuccess) {
    const upiUrl = `upi://pay?pa=${MERCHANT_UPI}&pn=StudentPrint&am=${price.total.toFixed(2)}&cu=INR&tn=StudentPrint%20Order`
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUrl)}`
    
    return (
      <section className="py-20 bg-white dark:bg-gray-800 flex items-center justify-center min-h-[80vh]">
        <div className="bg-white dark:bg-gray-700 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center border dark:border-gray-600">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-check text-2xl text-green-600 dark:text-green-400"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Order Placed!</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Please complete the payment below</p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl mb-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Amount to Pay</p>
            <p className="text-3xl font-extrabold text-primary">₹{price.total.toFixed(2)}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-inner inline-block mb-6 border">
            <img src={qrUrl} alt="UPI QR Code" className="w-48 h-48 mx-auto" />
          </div>

          <p className="text-xs text-gray-400 mb-6 px-4 italic leading-relaxed">
            Scan using PhonePe, GPay, Paytm or any UPI app to pay <span className="font-bold">₹{price.total.toFixed(2)}</span>.
          </p>

          <button onClick={() => window.location.reload()} className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">
             Done & Back to Site
          </button>
        </div>
      </section>
    )
  }

  const inputCls = 'w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-primary focus:border-primary'
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'

  return (
    <section id="upload" className="py-16 bg-white dark:bg-gray-800 transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-800 dark:text-white">Upload & Order</h2>
        <form onSubmit={handleSubmit} className="space-y-6">

          <div>
            <label className={labelCls}>Upload PDF/Word Assignment</label>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={handleFile} className={inputCls} />
            {detectedPages > 0 && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1"><i className="fas fa-file-alt mr-1"></i>{detectedPages} pages detected</p>}
          </div>

          <div>
            <label className={labelCls}>Number of Copies</label>
            <input type="number" min="1" value={copies} onChange={e => setCopies(parseInt(e.target.value) || 1)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Package Type</label>
            <select value={packageType} onChange={e => setPackageType(e.target.value)} className={inputCls}>
              {Object.keys(RATES).map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Print Type</label>
            <div className="grid grid-cols-3 gap-3">
              {['bw', 'colour', 'mixed'].map(t => (
                <button key={t} type="button" onClick={() => setPrintType(t)}
                  className={`p-3 border-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${printType === t ? 'border-primary bg-primary text-white' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-primary'}`}>
                  <i className={`fas ${t === 'bw' ? 'fa-circle-half-stroke' : t === 'colour' ? 'fa-palette' : 'fa-sliders'}`}></i>
                  {t === 'bw' ? 'B&W' : t === 'colour' ? 'Colour' : 'Mixed'}
                </button>
              ))}
            </div>
            {printType === 'mixed' && detectedPages > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Click each page to toggle B&W / Colour:</p>
                <div className="flex flex-wrap gap-2">
                  {pageTypes.map((type, i) => (
                    <button key={i} type="button" onClick={() => togglePageType(i)}
                      className={`w-10 h-10 rounded text-xs font-bold border-2 transition ${type === 'colour' ? 'border-pink-400 bg-pink-100 text-pink-700' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary'}`}>
                      {i + 1}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {pageTypes.filter(t => t === 'bw').length} B&W | {pageTypes.filter(t => t === 'colour').length} Colour
                </p>
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Binding</label>
            <div className="space-y-2">
              {[['none', 'No Binding'], ['soft', 'Soft Binding (+₹10)'], ['spiral', 'Spiral Binding (+₹20)']].map(([val, label]) => (
                <label key={val} className="flex items-center cursor-pointer text-gray-700 dark:text-gray-300">
                  <input type="radio" name="binding" value={val} checked={binding === val} onChange={() => setBinding(val)} className="mr-2" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Delivery Date</label>
              <input type="date" value={deliveryDate} min={new Date().toISOString().split('T')[0]} onChange={e => setDeliveryDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Delivery Time</label>
              <input type="time" value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Payment Method</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {PAYMENT_METHODS.map(({ method, icon }) => (
                <button key={method} type="button" onClick={() => setSelectedPayment(method)}
                  className={`p-3 border rounded-lg flex items-center justify-center gap-2 transition ${selectedPayment === method ? 'bg-primary text-white border-primary' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-primary hover:text-white'}`}>
                  <i className={`fas ${icon}`}></i> {method}
                </button>
              ))}
            </div>
            {selectedPayment && (
              <div className="mt-3">
                <label className={labelCls}>Enter your UPI ID</label>
                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                  <span className="px-3 py-3 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm"><i className="fas fa-at"></i></span>
                  <input type="text" value={upiId} onChange={e => setUpiId(e.target.value)}
                    placeholder={PAYMENT_METHODS.find(p => p.method === selectedPayment)?.placeholder}
                    className="flex-1 p-3 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
                </div>
                <p className="text-xs text-gray-400 mt-1">e.g. 9876543210@paytm, name@okaxis</p>
              </div>
            )}
          </div>

          {price && (
            <div className="bg-blue-50 dark:bg-gray-700 border border-blue-200 dark:border-gray-600 rounded-lg p-4 space-y-1 text-sm text-gray-700 dark:text-gray-200">
              <div className="flex justify-between"><span>Pages:</span><span>{detectedPages}</span></div>
              <div className="flex justify-between"><span>Copies:</span><span>{copies}</span></div>
              <div className="flex justify-between"><span>Print type:</span><span>{printType === 'bw' ? 'B&W' : printType === 'colour' ? 'Colour' : 'Mixed'}</span></div>
              {printType === 'mixed' && <>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400"><span>&nbsp;&nbsp;B&W pages:</span><span>{price.bwPages}</span></div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400"><span>&nbsp;&nbsp;Colour pages:</span><span>{price.colourPages}</span></div>
              </>}
              <div className="flex justify-between"><span>Rate ({packageType}):</span><span>₹{price.baseRate}/page</span></div>
              <div className="flex justify-between"><span>Print cost:</span><span>₹{price.printCost.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Binding:</span><span>₹{price.bindingCost}</span></div>
              <div className="flex justify-between font-bold text-base border-t border-blue-300 dark:border-gray-500 pt-2 mt-1">
                <span>Total:</span><span className="text-primary">₹{price.total.toFixed(2)}</span>
              </div>
            </div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full bg-primary text-white py-4 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-60">
            {submitting ? 'Placing Order...' : 'Place Order'}
          </button>
        </form>
      </div>
    </section>
  )
}
