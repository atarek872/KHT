export interface ProductReview {
  id: string
  displayName: string
  rating: number
  body: string
  createdAt: string
}

export interface ProductReviewResponse {
  reviews: ProductReview[]
  count: number
  average: number | null
}

export interface AdminProductReview extends ProductReview {
  productName: string
  orderNumber: string | null
  status: 'pending' | 'approved' | 'rejected'
}
