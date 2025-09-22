(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-VIDEO-ID u101)
(define-constant ERR-INVALID-PRICE u102)
(define-constant ERR-LISTING-NOT-FOUND u103)
(define-constant ERR-LISTING-INACTIVE u104)
(define-constant ERR-ALREADY-OWNER u105)
(define-constant ERR-PAYMENT-FAILED u106)
(define-constant ERR-ACCESS-DENIED u107)
(define-constant ERR-INVALID-LISTING-ID u108)
(define-constant ERR-ROYALTY-FAILED u109)
(define-constant ERR-REWARDS-FAILED u110)
(define-constant ERR-INVALID-OWNER u111)
(define-constant ERR-GENERATE-KEY-FAILED u112)
(define-constant ERR-INVALID-CREATOR u113)
(define-constant ERR-DUPLICATE-LISTING u114)
(define-constant ERR-INVALID-STATUS u115)
(define-constant ERR-MAX-LISTINGS-EXCEEDED u116)
(define-constant ERR-INVALID-UPDATE-PARAM u117)
(define-constant ERR-UPDATE-NOT-ALLOWED u118)

(define-data-var listing-counter uint u0)
(define-data-var max-listings uint u10000)
(define-data-var platform-fee uint u500)
(define-data-var admin-principal principal tx-sender)

(define-map listings
  uint
  {
    video-id: uint,
    creator: principal,
    price: uint,
    is-active: bool,
    owner: principal,
    timestamp: uint,
    royalty-rate: uint,
    views: uint,
    likes: uint,
    status: (string-utf8 20)
  }
)

(define-map listings-by-video
  uint
  uint
)

(define-map listing-updates
  uint
  {
    update-price: uint,
    update-status: (string-utf8 20),
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-listing (id uint))
  (map-get? listings id)
)

(define-read-only (get-listing-updates (id uint))
  (map-get? listing-updates id)
)

(define-read-only (is-listing-registered (video-id uint))
  (is-some (map-get? listings-by-video video-id))
)

(define-read-only (get-listing-count)
  (ok (var-get listing-counter))
)

(define-private (validate-video-id (video-id uint))
  (if (> video-id u0)
      (ok true)
      (err ERR-INVALID-VIDEO-ID))
)

(define-private (validate-price (price uint))
  (if (> price u0)
      (ok true)
      (err ERR-INVALID-PRICE))
)

(define-private (validate-royalty-rate (rate uint))
  (if (<= rate u100)
      (ok true)
      (err ERR-INVALID-UPDATE-PARAM))
)

(define-private (validate-status (status (string-utf8 20)))
  (if (or (is-eq status "active") (is-eq status "sold") (is-eq status "pending"))
      (ok true)
      (err ERR-INVALID-STATUS))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-admin-principal (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-admin 'SP000000000000000000002Q6VF78)) (err ERR-NOT-AUTHORIZED))
    (var-set admin-principal new-admin)
    (ok true)
  )
)

(define-public (set-max-listings (new-max uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-max u0) (err ERR-INVALID-UPDATE-PARAM))
    (var-set max-listings new-max)
    (ok true)
  )
)

(define-public (set-platform-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (var-set platform-fee new-fee)
    (ok true)
  )
)

(define-public (list-video (video-id uint) (price uint) (royalty-rate uint))
  (let
    (
      (listing-id (var-get listing-counter))
      (creator tx-sender)
      (safe-price (if (> price u0) price u1))
      (safe-royalty-rate (if (<= royalty-rate u100) royalty-rate u0))
    )
    (asserts! (< listing-id (var-get max-listings)) (err ERR-MAX-LISTINGS-EXCEEDED))
    (try! (validate-video-id video-id))
    (try! (validate-price safe-price))
    (try! (validate-royalty-rate safe-royalty-rate))
    (asserts! (is-eq (default-to creator (as-contract (contract-call? .CreatorRegistry get-creator creator))) creator) (err ERR-INVALID-CREATOR))
    (asserts! (is-eq (default-to creator (as-contract (contract-call? .VideoRegistry get-video-owner video-id))) creator) (err ERR-INVALID-OWNER))
    (asserts! (as-contract (contract-call? .ContentVerification is-unique-hash video-id)) (err ERR-DUPLICATE-LISTING))
    (asserts! (is-none (map-get? listings-by-video video-id)) (err ERR-DUPLICATE-LISTING))
    (try! (stx-transfer? (var-get platform-fee) tx-sender (var-get admin-principal)))
    (map-set listings listing-id
      {
        video-id: video-id,
        creator: creator,
        price: safe-price,
        is-active: true,
        owner: creator,
        timestamp: block-height,
        royalty-rate: safe-royalty-rate,
        views: u0,
        likes: u0,
        status: "active"
      }
    )
    (map-set listings-by-video video-id listing-id)
    (var-set listing-counter (+ listing-id u1))
    (print { event: "video-listed", id: listing-id })
    (ok listing-id)
  )
)

(define-public (buy-video (listing-id uint))
  (let
    (
      (listing (unwrap! (map-get? listings listing-id) (err ERR-LISTING-NOT-FOUND)))
      (buyer tx-sender)
      (price (get price listing))
      (creator (get creator listing))
      (current-owner (get owner listing))
      (video-id (get video-id listing))
      (royalty-rate (get royalty-rate listing))
    )
    (asserts! (get is-active listing) (err ERR-LISTING-INACTIVE))
    (asserts! (not (is-eq buyer current-owner)) (err ERR-ALREADY-OWNER))
    (try! (as-contract (contract-call? .Payment process-payment buyer current-owner price)))
    (if (not (is-eq current-owner creator))
        (try! (as-contract (contract-call? .RoyaltyManagement distribute-royalties video-id price creator royalty-rate)))
        (ok true)
    )
    (try! (as-contract (contract-call? .AccessControl generate-access-key buyer video-id)))
    (try! (as-contract (contract-call? .FanRewards award-points buyer price)))
    (map-set listings listing-id
      (merge listing
        {
          owner: buyer,
          is-active: false,
          timestamp: block-height,
          status: "sold"
        }
      )
    )
    (print { event: "video-bought", id: listing-id, buyer: buyer })
    (ok true)
  )
)

(define-public (resell-video (listing-id uint) (new-price uint))
  (let
    (
      (listing (unwrap! (map-get? listings listing-id) (err ERR-LISTING-NOT-FOUND)))
      (seller tx-sender)
      (safe-new-price (if (> new-price u0) new-price u1))
    )
    (asserts! (is-eq (get owner listing) seller) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (get is-active listing)) (err ERR-LISTING-INACTIVE))
    (try! (validate-price safe-new-price))
    (map-set listings listing-id
      (merge listing
        {
          price: safe-new-price,
          is-active: true,
          timestamp: block-height,
          status: "active"
        }
      )
    )
    (print { event: "video-resold", id: listing-id, price: safe-new-price })
    (ok true)
  )
)

(define-public (deactivate-listing (listing-id uint))
  (let
    (
      (listing (unwrap! (map-get? listings listing-id) (err ERR-LISTING-NOT-FOUND)))
      (caller tx-sender)
    )
    (asserts! (or (is-eq (get owner listing) caller) (is-eq (get creator listing) caller)) (err ERR-NOT-AUTHORIZED))
    (asserts! (get is-active listing) (err ERR-LISTING-INACTIVE))
    (map-set listings listing-id
      (merge listing
        {
          is-active: false,
          timestamp: block-height,
          status: "inactive"
        }
      )
    )
    (print { event: "listing-deactivated", id: listing-id })
    (ok true)
  )
)

(define-public (update-listing (listing-id uint) (update-price uint) (update-status (string-utf8 20)))
  (let
    (
      (listing (unwrap! (map-get? listings listing-id) (err ERR-LISTING-NOT-FOUND)))
      (updater tx-sender)
      (safe-update-price (if (> update-price u0) update-price u1))
    )
    (asserts! (is-eq (get creator listing) updater) (err ERR-NOT-AUTHORIZED))
    (try! (validate-price safe-update-price))
    (try! (validate-status update-status))
    (map-set listings listing-id
      (merge listing
        {
          price: safe-update-price,
          status: update-status,
          timestamp: block-height
        }
      )
    )
    (map-set listing-updates listing-id
      {
        update-price: safe-update-price,
        update-status: update-status,
        update-timestamp: block-height,
        updater: updater
      }
    )
    (print { event: "listing-updated", id: listing-id })
    (ok true)
  )
)

(define-public (increment-views (listing-id uint))
  (let
    (
      (listing (unwrap! (map-get? listings listing-id) (err ERR-LISTING-NOT-FOUND)))
    )
    (asserts! (is-eq (get owner listing) tx-sender) (err ERR-ACCESS-DENIED))
    (map-set listings listing-id
      (merge listing { views: (+ (get views listing) u1) })
    )
    (ok true)
  )
)

(define-public (like-video (listing-id uint))
  (let
    (
      (listing (unwrap! (map-get? listings listing-id) (err ERR-LISTING-NOT-FOUND)))
    )
    (asserts! (is-eq (get owner listing) tx-sender) (err ERR-ACCESS-DENIED))
    (map-set listings listing-id
      (merge listing { likes: (+ (get likes listing) u1) })
    )
    (ok true)
  )
)