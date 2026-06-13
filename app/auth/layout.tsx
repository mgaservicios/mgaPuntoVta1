import Image from 'next/image'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4 flex justify-center">
          <Image
            src="/logos/posmga_erp.png"
            alt="POS MGA ERP"
            width={360}
            height={220}
            priority
            className="object-contain w-full h-auto"
          />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
