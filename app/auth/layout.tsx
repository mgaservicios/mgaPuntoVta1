import Image from 'next/image'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 py-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-3 flex justify-center">
          <Image
            src="/logos/posmga_erp.png"
            alt="POS MGA ERP"
            width={320}
            height={140}
            priority
            className="object-contain w-full h-auto max-h-32"
          />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
