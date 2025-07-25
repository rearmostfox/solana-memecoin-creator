'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import TokenCreator from '@/components/TokenCreator'
import SolanaPrice from '@/components/SolanaPrice'
import '@solana/wallet-adapter-react-ui/styles.css'

export default function Home() {
  const { publicKey, connected } = useWallet()
  const [balance, setBalance] = useState<number>(0)

  useEffect(() => {
    if (publicKey) {
      const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!)
      connection.getBalance(publicKey).then(balance => {
        setBalance(balance / LAMPORTS_PER_SOL)
      })
    }
  }, [publicKey])

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-100 via-dark-200 to-purple-900/20">
      <div className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Solana Memecoin Creator
            </h1>
            <p className="text-dark-400 mt-2">Create your token in seconds</p>
          </div>
          
          <div className="flex items-center gap-4">
            <SolanaPrice />
            <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
          </div>
        </header>

        {connected && (
          <div className="glassmorphism rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-dark-400">Wallet Balance:</span>
              <span className="text-2xl font-bold">{balance.toFixed(4)} SOL</span>
            </div>
          </div>
        )}

        <TokenCreator balance={balance} connected={connected} />
      </div>
    </div>
  )
}