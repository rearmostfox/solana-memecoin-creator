'use client'

import { useRef } from 'react'
import { Upload } from 'lucide-react'

interface ImageUploadProps {
  onImageSelect: (file: File, preview: string) => void
  preview: string
}

export default function ImageUpload({ onImageSelect, preview }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        onImageSelect(file, reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium">Token Logo</label>
      
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Token preview"
            className="w-32 h-32 rounded-lg object-cover"
          />
          <button
            onClick={() => {
              onImageSelect(null as any, '')
            }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white text-xs"
          >
            ×
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="w-32 h-32 border-2 border-dashed border-dark-400 rounded-lg flex items-center justify-center cursor-pointer hover:border-purple-500"
        >
          <Upload className="w-8 h-8 text-dark-400" />
        </div>
      )}
      
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}