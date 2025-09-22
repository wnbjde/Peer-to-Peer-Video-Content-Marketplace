 
import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_VIDEO_ID = 101;
const ERR_INVALID_PRICE = 102;
const ERR_LISTING_NOT_FOUND = 103;
const ERR_LISTING_INACTIVE = 104;
const ERR_ALREADY_OWNER = 105;
const ERR_PAYMENT_FAILED = 106;
const ERR_ACCESS_DENIED = 107;
const ERR_INVALID_LISTING_ID = 108;
const ERR_ROYALTY_FAILED = 109;
const ERR_REWARDS_FAILED = 110;
const ERR_INVALID_OWNER = 111;
const ERR_GENERATE_KEY_FAILED = 112;
const ERR_INVALID_CREATOR = 113;
const ERR_DUPLICATE_LISTING = 114;
const ERR_INVALID_STATUS = 115;
const ERR_MAX_LISTINGS_EXCEEDED = 116;
const ERR_INVALID_UPDATE_PARAM = 117;
const ERR_UPDATE_NOT_ALLOWED = 118;

interface Listing {
	videoId: number;
	creator: string;
	price: number;
	isActive: boolean;
	owner: string;
	timestamp: number;
	royaltyRate: number;
	views: number;
	likes: number;
	status: string;
}

interface ListingUpdate {
	updatePrice: number;
	updateStatus: string;
	updateTimestamp: number;
	updater: string;
}

interface Result<T> {
	ok: boolean;
	value: T;
}

class MarketplaceMock {
	state: {
		listingCounter: number;
		maxListings: number;
		platformFee: number;
		adminPrincipal: string;
		listings: Map<number, Listing>;
		listingUpdates: Map<number, ListingUpdate>;
		listingsByVideo: Map<number, number>;
	} = {
		listingCounter: 0,
		maxListings: 10000,
		platformFee: 500,
		adminPrincipal: "ST1TEST",
		listings: new Map(),
		listingUpdates: new Map(),
		listingsByVideo: new Map(),
	};
	blockHeight: number = 0;
	caller: string = "ST1TEST";
	stxTransfers: Array<{ amount: number; from: string; to: string }> = [];

	constructor() {
		this.reset();
	}

	reset() {
		this.state = {
			listingCounter: 0,
			maxListings: 10000,
			platformFee: 500,
			adminPrincipal: "ST1TEST",
			listings: new Map(),
			listingUpdates: new Map(),
			listingsByVideo: new Map(),
		};
		this.blockHeight = 0;
		this.caller = "ST1TEST";
		this.stxTransfers = [];
	}

	setAdminPrincipal(newAdmin: string): Result<boolean> {
		if (this.caller !== this.state.adminPrincipal)
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		if (newAdmin === "SP000000000000000000002Q6VF78")
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		this.state.adminPrincipal = newAdmin;
		return { ok: true, value: true };
	}

	setMaxListings(newMax: number): Result<boolean> {
		if (this.caller !== this.state.adminPrincipal)
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		if (newMax <= 0) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
		this.state.maxListings = newMax;
		return { ok: true, value: true };
	}

	setPlatformFee(newFee: number): Result<boolean> {
		if (this.caller !== this.state.adminPrincipal)
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		if (newFee < 0) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
		this.state.platformFee = newFee;
		return { ok: true, value: true };
	}

	listVideo(
		videoId: number,
		price: number,
		royaltyRate: number
	): Result<number> {
		if (this.state.listingCounter >= this.state.maxListings)
			return { ok: false, value: ERR_MAX_LISTINGS_EXCEEDED };
		if (videoId <= 0) return { ok: false, value: ERR_INVALID_VIDEO_ID };
		if (price <= 0) return { ok: false, value: ERR_INVALID_PRICE };
		if (royaltyRate > 100)
			return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
		if (this.state.listingsByVideo.has(videoId))
			return { ok: false, value: ERR_DUPLICATE_LISTING };
		this.stxTransfers.push({
			amount: this.state.platformFee,
			from: this.caller,
			to: this.state.adminPrincipal,
		});
		const id = this.state.listingCounter;
		const listing: Listing = {
			videoId,
			creator: this.caller,
			price,
			isActive: true,
			owner: this.caller,
			timestamp: this.blockHeight,
			royaltyRate,
			views: 0,
			likes: 0,
			status: "active",
		};
		this.state.listings.set(id, listing);
		this.state.listingsByVideo.set(videoId, id);
		this.state.listingCounter++;
		return { ok: true, value: id };
	}

	buyVideo(listingId: number): Result<boolean> {
		const listing = this.state.listings.get(listingId);
		if (!listing) return { ok: false, value: ERR_LISTING_NOT_FOUND };
		if (!listing.isActive) return { ok: false, value: ERR_LISTING_INACTIVE };
		if (this.caller === listing.owner)
			return { ok: false, value: ERR_ALREADY_OWNER };
		const updated: Listing = {
			...listing,
			owner: this.caller,
			isActive: false,
			timestamp: this.blockHeight,
			status: "sold",
		};
		this.state.listings.set(listingId, updated);
		return { ok: true, value: true };
	}

	resellVideo(listingId: number, newPrice: number): Result<boolean> {
		const listing = this.state.listings.get(listingId);
		if (!listing) return { ok: false, value: ERR_LISTING_NOT_FOUND };
		if (listing.owner !== this.caller)
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		if (listing.isActive) return { ok: false, value: ERR_LISTING_INACTIVE };
		if (newPrice <= 0) return { ok: false, value: ERR_INVALID_PRICE };
		const updated: Listing = {
			...listing,
			price: newPrice,
			isActive: true,
			timestamp: this.blockHeight,
			status: "active",
		};
		this.state.listings.set(listingId, updated);
		return { ok: true, value: true };
	}

	deactivateListing(listingId: number): Result<boolean> {
		const listing = this.state.listings.get(listingId);
		if (!listing) return { ok: false, value: ERR_LISTING_NOT_FOUND };
		if (listing.owner !== this.caller && listing.creator !== this.caller)
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		if (!listing.isActive) return { ok: false, value: ERR_LISTING_INACTIVE };
		const updated: Listing = {
			...listing,
			isActive: false,
			timestamp: this.blockHeight,
			status: "inactive",
		};
		this.state.listings.set(listingId, updated);
		return { ok: true, value: true };
	}

	updateListing(
		listingId: number,
		updatePrice: number,
		updateStatus: string
	): Result<boolean> {
		const listing = this.state.listings.get(listingId);
		if (!listing) return { ok: false, value: ERR_LISTING_NOT_FOUND };
		if (listing.creator !== this.caller)
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		if (updatePrice <= 0) return { ok: false, value: ERR_INVALID_PRICE };
		if (!["active", "sold", "pending"].includes(updateStatus))
			return { ok: false, value: ERR_INVALID_STATUS };
		const updated: Listing = {
			...listing,
			price: updatePrice,
			status: updateStatus,
			timestamp: this.blockHeight,
		};
		this.state.listings.set(listingId, updated);
		this.state.listingUpdates.set(listingId, {
			updatePrice,
			updateStatus,
			updateTimestamp: this.blockHeight,
			updater: this.caller,
		});
		return { ok: true, value: true };
	}

	incrementViews(listingId: number): Result<boolean> {
		const listing = this.state.listings.get(listingId);
		if (!listing) return { ok: false, value: ERR_LISTING_NOT_FOUND };
		if (listing.owner !== this.caller)
			return { ok: false, value: ERR_ACCESS_DENIED };
		const updated: Listing = {
			...listing,
			views: listing.views + 1,
		};
		this.state.listings.set(listingId, updated);
		return { ok: true, value: true };
	}

	likeVideo(listingId: number): Result<boolean> {
		const listing = this.state.listings.get(listingId);
		if (!listing) return { ok: false, value: ERR_LISTING_NOT_FOUND };
		if (listing.owner !== this.caller)
			return { ok: false, value: ERR_ACCESS_DENIED };
		const updated: Listing = {
			...listing,
			likes: listing.likes + 1,
		};
		this.state.listings.set(listingId, updated);
		return { ok: true, value: true };
	}

	getListing(listingId: number): Listing | null {
		return this.state.listings.get(listingId) || null;
	}

	getListingCount(): Result<number> {
		return { ok: true, value: this.state.listingCounter };
	}
}

describe("Marketplace", () => {
	let contract: MarketplaceMock;

	beforeEach(() => {
		contract = new MarketplaceMock();
		contract.reset();
	});

	it("lists a video successfully", () => {
		const result = contract.listVideo(1, 100, 10);
		expect(result.ok).toBe(true);
		expect(result.value).toBe(0);
		const listing = contract.getListing(0);
		expect(listing?.videoId).toBe(1);
		expect(listing?.price).toBe(100);
		expect(listing?.royaltyRate).toBe(10);
		expect(listing?.isActive).toBe(true);
		expect(contract.stxTransfers).toEqual([
			{ amount: 500, from: "ST1TEST", to: "ST1TEST" },
		]);
	});

	it("rejects duplicate video listing", () => {
		contract.listVideo(1, 100, 10);
		const result = contract.listVideo(1, 200, 15);
		expect(result.ok).toBe(false);
		expect(result.value).toBe(ERR_DUPLICATE_LISTING);
	});

	it("rejects invalid video id", () => {
		const result = contract.listVideo(0, 100, 10);
		expect(result.ok).toBe(false);
		expect(result.value).toBe(ERR_INVALID_VIDEO_ID);
	});

	it("buys a video successfully", () => {
		contract.listVideo(1, 100, 10);
		contract.caller = "ST2BUYER";
		const result = contract.buyVideo(0);
		expect(result.ok).toBe(true);
		expect(result.value).toBe(true);
		const listing = contract.getListing(0);
		expect(listing?.owner).toBe("ST2BUYER");
		expect(listing?.isActive).toBe(false);
		expect(listing?.status).toBe("sold");
	});

	it("rejects buy by current owner", () => {
		contract.listVideo(1, 100, 10);
		const result = contract.buyVideo(0);
		expect(result.ok).toBe(false);
		expect(result.value).toBe(ERR_ALREADY_OWNER);
	});

	it("resells a video successfully", () => {
		contract.listVideo(1, 100, 10);
		contract.caller = "ST2BUYER";
		contract.buyVideo(0);
		const result = contract.resellVideo(0, 200);
		expect(result.ok).toBe(true);
		expect(result.value).toBe(true);
		const listing = contract.getListing(0);
		expect(listing?.price).toBe(200);
		expect(listing?.isActive).toBe(true);
		expect(listing?.status).toBe("active");
	});

	it("deactivates a listing successfully", () => {
		contract.listVideo(1, 100, 10);
		const result = contract.deactivateListing(0);
		expect(result.ok).toBe(true);
		expect(result.value).toBe(true);
		const listing = contract.getListing(0);
		expect(listing?.isActive).toBe(false);
		expect(listing?.status).toBe("inactive");
	});

	it("updates a listing successfully", () => {
		contract.listVideo(1, 100, 10);
		const result = contract.updateListing(0, 150, "pending");
		expect(result.ok).toBe(true);
		expect(result.value).toBe(true);
		const listing = contract.getListing(0);
		expect(listing?.price).toBe(150);
		expect(listing?.status).toBe("pending");
	});

	it("increments views successfully", () => {
		contract.listVideo(1, 100, 10);
		contract.caller = "ST2BUYER";
		contract.buyVideo(0);
		const result = contract.incrementViews(0);
		expect(result.ok).toBe(true);
		expect(result.value).toBe(true);
		const listing = contract.getListing(0);
		expect(listing?.views).toBe(1);
	});

	it("likes a video successfully", () => {
		contract.listVideo(1, 100, 10);
		contract.caller = "ST2BUYER";
		contract.buyVideo(0);
		const result = contract.likeVideo(0);
		expect(result.ok).toBe(true);
		expect(result.value).toBe(true);
		const listing = contract.getListing(0);
		expect(listing?.likes).toBe(1);
	});

	it("sets platform fee successfully", () => {
		const result = contract.setPlatformFee(1000);
		expect(result.ok).toBe(true);
		expect(result.value).toBe(true);
		expect(contract.state.platformFee).toBe(1000);
	});

	it("returns correct listing count", () => {
		contract.listVideo(1, 100, 10);
		contract.listVideo(2, 200, 15);
		const result = contract.getListingCount();
		expect(result.ok).toBe(true);
		expect(result.value).toBe(2);
	});

	it("rejects max listings exceeded", () => {
		contract.state.maxListings = 1;
		contract.listVideo(1, 100, 10);
		const result = contract.listVideo(2, 200, 15);
		expect(result.ok).toBe(false);
		expect(result.value).toBe(ERR_MAX_LISTINGS_EXCEEDED);
	});
});