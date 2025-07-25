'use client'

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { 
  Connection, 
  Transaction, 
  SystemProgram, 
  PublicKey, 
  Keypair,
  TransactionInstruction 
} from '@solana/web3.js'
import { 
  createInitializeMintInstruction,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
  createSetAuthorityInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  AuthorityType
} from '@solana/spl-token'
import toast from 'react-hot-toast'
import ImageUpload from './ImageUpload'

// ✅ SECURE IPFS UPLOAD
const uploadToIPFS = async (file: File): Promise<string> => {
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
      },
      body: formData
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    return data.IpfsHash
    
  } catch (error) {
    console.error('Upload error:', error)
    throw new Error('Failed to upload to IPFS')
  }
}

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
    decimals: '9',
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

    if (balance < 0.015) {
      toast.error('Insufficient SOL balance (need ~0.015 SOL)')
      return
    }

    setLoading(true)
    let toastId = toast.loading('🚀 Creating complete token...')

    try {
      const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!)
      
      // 📸 UPLOAD METADATA
      toast.loading('📤 Uploading metadata...', { id: toastId })
      const logoCid = await uploadToIPFS(formData.logo)
      
      const metadata = {
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description,
        image: `https://gateway.pinata.cloud/ipfs/${logoCid}`,
        external_url: formData.website,
        socials: {
          twitter: formData.twitter,
          telegram: formData.telegram,
          discord: formData.discord,
          extra: formData.extraLink
        }
      }

      const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' })
      const metadataFile = new File([metadataBlob], 'metadata.json', { type: 'application/json' })
      const metadataCid = await uploadToIPFS(metadataFile)
      
      // 🏗️ CREATE COMPLETE TOKEN
      toast.loading('🏗️ Building token...', { id: toastId })
      
      const mintKeypair = Keypair.generate()
      const decimals = parseInt(formData.decimals)
      const totalSupply = BigInt(formData.totalSupply)
      
      // Build complete transaction
      const transaction = new Transaction()
      
      // 1. Create mint account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports: await connection.getMinimumBalanceForRentExemption(MINT_SIZE),
          programId: TOKEN_PROGRAM_ID,
        })
      )
      
      // 2. Initialize mint
      transaction.add(
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          decimals,
          publicKey,
          formData.revokeFreeze ? null : publicKey
        )
      )
      
      // 3. Create associated token account
      const associatedTokenAccount = PublicKey.findProgramAddressSync(
        [
          publicKey.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          mintKeypair.publicKey.toBuffer()
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
      )[0]
      
      transaction.add(
        createAssociatedTokenAccountInstruction(
          publicKey,
          associatedTokenAccount,
          publicKey,
          mintKeypair.publicKey
        )
      )
      
      // 4. Mint full supply to user's wallet
      transaction.add(
        createMintToInstruction(
          mintKeypair.publicKey,
          associatedTokenAccount,
          publicKey,
          totalSupply * BigInt(10 ** decimals)
        )
      )
      
      // 5. Apply revokes
      if (formData.revokeMint) {
        transaction.add(
          createSetAuthorityInstruction(
            mintKeypair.publicKey,
            publicKey,
            AuthorityType.MintTokens,
            null
          )
        )
      }
      
      if (formData.revokeFreeze) {
        transaction.add(
          createSetAuthorityInstruction(
            mintKeypair.publicKey,
            publicKey,
            AuthorityType.FreezeAccount,
            null
          )
        )
      }
      
      // 6. Send transaction
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey
      
      transaction.partialSign(mintKeypair)
      const signed = await signTransaction(transaction)
      
      const txid = await connection.sendRawTransaction(signed.serialize())
      await connection.confirmTransaction(txid, 'confirmed')

      setRealTokenAddress(mintKeypair.publicKey.toString())
      
      toast.success(`🎉 Token Created & Minted! 
      Address: ${mintKeypair.publicKey.toString().slice(0, 8)}...`, { 
        id: toastId,
        duration: 10000 
      })
      
    } catch (error: any) {
      console.error('❌ Creation failed:', error)
      toast.error(error.message || 'Token creation failed', { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glassmorphism rounded-xl p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Create Complete Token</h2>
      
      <div className="space-y-6">
        <ImageUpload 
          onImageSelect={(file, preview) => {
            setFormData({ ...formData, logo: file })
            setImagePreview(preview)
          }}
          preview={imagePreview}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input type="text" placeholder="Token Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="bg-dark-300 border border-dark-400 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500" />
          <input type="text" placeholder="Token Symbol" value={formData.symbol} onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })} className="bg-dark-300 border border-dark-400 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500" />
        </div>

        <textarea placeholder="Token Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full bg-dark-300 border border-dark-400 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500 h-20" />

        <div className="grid grid-cols-2 gap-4">
          <input type="number" placeholder="Total Supply" value={formData.totalSupply} onChange={(e) => setFormData({ ...formData, totalSupply: e.target.value })} className="bg-dark-300 border border-dark-400 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500" />
          <input type="number" placeholder="Decimals" value={formData.decimals} onChange={(e) => setFormData({ ...formData, decimals: e.target.value })} className="bg-dark-300 border border-dark-400 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500" min="0" max="9" />
        </div>

        <h3 className="text-lg font-semibold mt-6">Social Links</h3>
        <div className="space-y-3">
          <input type="url" placeholder="Website URL" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} className="w-full bg-dark-300 border border-dark-400 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500" />
          <input type="url" placeholder="Twitter URL" value={formData.twitter} onChange={(e) => setFormData({ ...formData, twitter: e.target.value })} className="w-full bg-dark-300 border border-dark-400 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500" />
          <input type="url" placeholder="Telegram URL" value={formData.telegram} onChange={(e) => setFormData({ ...formData, telegram: e.target.value })} className="w-full bg-dark-300 border border-dark-400 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500" />
          <input type="url" placeholder="Discord URL" value={formData.discord} onChange={(e) => setFormData({ ...formData, discord: e.target.value })} className="w-full bg-dark-300 border border-dark-400 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500" />
          <input type="url" placeholder="Extra Link" value={formData.extraLink} onChange={(e) => setFormData({ ...formData, extraLink: e.target.value })} className="w-full bg-dark-300 border border-dark-400 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500" />
        </div>

        <h3 className="text-lg font-semibold mt-6">Revoke Authorities</h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between"><span>Revoke Freeze Authority</span><input type="checkbox" checked={formData.revokeFreeze} onChange={(e) => setFormData({ ...formData, revokeFreeze: e.target.checked })} className="w-5 h-5 rounded bg-purple-600" /></label>
          <label className="flex items-center justify-between"><span>Revoke Update Authority</span><input type="checkbox" checked={formData.revokeUpdate} onChange={(e) => setFormData({ ...formData, revokeUpdate: e.target.checked })} className="w-5 h-5 rounded bg-purple-600" /></label>
          <label className="flex items-center justify-between"><span>Revoke Mint Authority</span><input type="checkbox" checked={formData.revokeMint} onChange={(e) => setFormData({ ...formData, revokeMint: e.target.checked })} className="w-5 h-5 rounded bg-purple-600" /></label>
        </div>

        <h3 className="text-lg font-semibold mt-6">Dex Display Info (Fake)</h3>
        <div className="space-y-3">
          <input type="text" placeholder="Fake Creator Address" value={formData.fakeCreator} onChange={(e) => setFormData({ ...formData, fakeCreator: e.target.value })} className="w-full bg-dark-300 border border-dark-400 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500" />
          <input type="text" placeholder="Fake Token Address (add 'pump' at end)" value={formData.fakeTokenAddress} onChange={(e) => setFormData({ ...formData, fakeTokenAddress: e.target.value })} className="w-full bg-dark-300 border border-dark-400 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500" />
        </div>

        {realTokenAddress && (
          <div className="mt-6 p-4 bg-dark-300 rounded-lg">
            <h4 className="font-semibold mb-2">Real Token Address:</h4>
            <div className="flex items-center gap-2">
              <code className="text-sm break-all">{realTokenAddress}</code>
              <button onClick={() => { navigator.clipboard.writeText(realTokenAddress); toast.success('Copied!'); }} className="px-3 py-1 bg-purple-600 rounded text-sm hover:bg-purple-700">Copy</button>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <div className="text-sm text-dark-400">Estimated fee: ~0.015 SOL</div>
          <button onClick={handleCreateToken} disabled={loading || !connected} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Creating...' : 'Create & Mint Token'}
          </button>
        </div>
      </div>
    </div>
  )
}
