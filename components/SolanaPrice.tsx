'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

export default function SolanaPrice() {
  const [price, setPrice] = useState<number>(0)

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
        setPrice(response.data.solana.usd)
      } catch (error) {
        console.error('Error fetching SOL price:', error)
      }
    }

    fetchPrice()
    const interval = setInterval(fetchPrice, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="glassmorphism rounded-lg px-4 py-2">
      <span className="text-dark-400">SOL:</span>
      <span className="ml-2 font-bold">${price.toFixed(2)}</span>
    </div>
  )
}