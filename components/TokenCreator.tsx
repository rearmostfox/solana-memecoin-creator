'use client'

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, Transaction, SystemProgram, PublicKey, Keypair } from '@solana/web3.js'
import { createInitializeMintInstruction, TOKEN_PROGRAM_ID, MINT_SIZE } from '@solana/spl-token'
import { NFTStorage } from 'nft.storage'
import ImageUpload from './ImageUpload'
import toast from 'react-hot-toast'

interface TokenCreatorProps {
  balance: number
  connected: boolean
}

export default function TokenCreator({ balance, connected }: TokenCreatorProps) {
  const { publicKey, signTransaction } = useWallet()
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    totalSupply: '1000000000',
    website: '',
    twitter: '',
    telegram: '',
    discord: '',
    extraLink: '',
    revokeFreeze: true,
    revokeUpdate: true,
    revokeMint: true,
    fakeCreator: '',
    fakeTokenAddress: '',
    logo: null as File | null
  })

  const [realTokenAddress, setRealTokenAddress] = useState('')
  const [imagePreview, setImagePreview] = useState('')

  const handleCreateToken = async () => {
    if (!connected || !publicKey || !signTransaction) {
      toast.error('Please connect your wallet')
      return
    }

    if (!formData.name || !formData.symbol || !formData.description || !formData.logo) {
      toast.error('Please fill all required fields')
      return
    }

    if (balance < 0.02) {
      toast.error('Insufficient SOL balance (need ~0.02 SOL)')
      return
    }

    setLoading(true)

    try {
      // Upload logo to IPFS
      const client = new NFTStorage({ token: process.env.NFT_STORAGE_KEY! })
      const cid = await client.storeBlob(formData.logo!)
      
      // Create metadata
      const metadata = {
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description,
        image: `https://nftstorage.link/ipfs/${cid}`,
        extensions: {
          website: formData.website,
          twitter: formData.twitter,
          telegram: formData.telegram,
          discord: formData.discord,
          extra: formData.extraLink
        }
      }

      // Upload metadata
      const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' })
      const metadataCid = await client.storeBlob(metadataBlob)
      const metadataUri = `https://nftstorage.link/ipfs/${metadataCid}`

      // Create token on Solana
      const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!)
      
      const mintKeypair = Keypair.generate() // ✅ FIXED: Use Keypair instead of PublicKey
      const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE)

      const transaction = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          9,
          publicKey,
          formData.revokeFreeze ? null : publicKey
        )
      )

      const { blockhash } = await connection.getRecentBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      transaction.partialSign(mintKeypair)

      const signed = await signTransaction(transaction)
      const txid = await connection.sendRawTransaction(signed.serialize())
      await connection.confirmTransaction(txid)

      setRealTokenAddress(mintKeypair.publicKey.toString())
      toast.success('Token created successfully!')
      
    } catch (error) {
      console.error('Error creating token:', error)
      toast.error('Failed to create token')
    } finally {
      setLoading(false)
    }
  }

  // ... rest of the file stays the same
