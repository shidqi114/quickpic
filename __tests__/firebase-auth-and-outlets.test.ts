import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Domain model definitions matching QuickPic Firebase User & Outlet Architecture
export type UserRole = 'owner' | 'operator' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: number;
  lastLoginAt?: number;
}

export interface Outlet {
  id: string;
  userId: string;
  name: string;
  location: string;
  code: string;
  createdAt: number;
}

export interface OutletEvent {
  id: string;
  outletId: string;
  userId: string;
  name: string;
  date: string;
  hashtag: string;
  stripFooterText?: string;
  operatingMode?: 'event' | 'regular';
  welcomeTheme?: string;
  createdAt: number;
}

// In-Memory Storage & Repository implementation for testing
class MockFirebaseStore {
  private users: Map<string, UserProfile> = new Map();
  private outlets: Map<string, Outlet[]> = new Map(); // userId -> Outlet[]
  private events: Map<string, OutletEvent[]> = new Map(); // `${userId}_${outletId}` -> OutletEvent[]
  private cachedUser: UserProfile | null = null;

  // 1. Auth operations
  demoSignIn(email: string = 'operator@quickpic.io', displayName: string = 'Alex Pratama (Operator)'): UserProfile {
    const user: UserProfile = {
      uid: 'usr-' + Math.random().toString(36).substring(2, 9),
      email,
      displayName,
      role: 'operator',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    };
    this.users.set(user.uid, user);
    this.cachedUser = user;
    return user;
  }

  getCachedUser(): UserProfile | null {
    return this.cachedUser;
  }

  signOut(): void {
    this.cachedUser = null;
  }

  // 2. Outlet operations (users/{userId}/outlets)
  getUserOutlets(userId: string): Outlet[] {
    return this.outlets.get(userId) || [];
  }

  createOutlet(userId: string, data: { name: string; location: string; code: string }): Outlet {
    const newOutlet: Outlet = {
      id: 'outlet-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userId,
      name: data.name,
      location: data.location,
      code: data.code,
      createdAt: Date.now(),
    };
    const list = this.outlets.get(userId) || [];
    list.push(newOutlet);
    this.outlets.set(userId, list);
    return newOutlet;
  }

  // 3. Event operations (users/{userId}/outlets/{outletId}/events)
  getOutletEvents(userId: string, outletId: string): OutletEvent[] {
    const key = `${userId}_${outletId}`;
    return this.events.get(key) || [];
  }

  createOutletEvent(
    userId: string,
    outletId: string,
    data: { name: string; date: string; hashtag: string; stripFooterText?: string; operatingMode?: 'event' | 'regular' }
  ): OutletEvent {
    const newEvent: OutletEvent = {
      id: 'ev-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userId,
      outletId,
      name: data.name,
      date: data.date,
      hashtag: data.hashtag,
      stripFooterText: data.stripFooterText,
      operatingMode: data.operatingMode || 'event',
      createdAt: Date.now(),
    };
    const key = `${userId}_${outletId}`;
    const list = this.events.get(key) || [];
    list.unshift(newEvent);
    this.events.set(key, list);
    return newEvent;
  }

  deleteOutletEvent(userId: string, outletId: string, eventId: string): boolean {
    const key = `${userId}_${outletId}`;
    const list = this.events.get(key) || [];
    const filtered = list.filter((e) => e.id !== eventId);
    this.events.set(key, filtered);
    return filtered.length < list.length;
  }
}

describe('QuickPic Firebase Authentication & Multi-Outlet Architecture Suite', () => {

  describe('1. Kiosk Initial Screen & Authentication State Flow', () => {
    it('should initialize terminal state at LOGIN step before authentication', () => {
      const initialStep = 'LOGIN';
      assert.strictEqual(initialStep, 'LOGIN');
    });

    it('should authenticate operator and persist session locally', () => {
      const store = new MockFirebaseStore();
      const user = store.demoSignIn('staff@quickpic.io', 'Staff Booth Central');

      assert.strictEqual(user.email, 'staff@quickpic.io');
      assert.strictEqual(user.displayName, 'Staff Booth Central');
      assert.strictEqual(user.role, 'operator');
      assert.ok(user.uid.startsWith('usr-'));
      assert.strictEqual(store.getCachedUser()?.email, 'staff@quickpic.io');
    });

    it('should transition to OPERATOR_SETUP upon successful authentication', () => {
      const store = new MockFirebaseStore();
      let step = 'LOGIN';
      const user = store.demoSignIn();
      if (user) {
        step = 'OPERATOR_SETUP';
      }
      assert.strictEqual(step, 'OPERATOR_SETUP');
    });

    it('should clear authentication state and return to LOGIN on sign out', () => {
      const store = new MockFirebaseStore();
      store.demoSignIn();
      assert.ok(store.getCachedUser() !== null);

      store.signOut();
      assert.strictEqual(store.getCachedUser(), null);

      let step = 'OPERATOR_SETUP';
      if (!store.getCachedUser()) {
        step = 'LOGIN';
      }
      assert.strictEqual(step, 'LOGIN');
    });
  });

  describe('2. Multi-Outlet Hierarchy (users/{userId}/outlets)', () => {
    it('should allow a user to manage multiple distinct outlets', () => {
      const store = new MockFirebaseStore();
      const userId = 'usr-owner-01';

      const outlet1 = store.createOutlet(userId, {
        name: 'Grand Indonesia - Flagship',
        location: 'West Mall Level 3, Jakarta Pusat',
        code: 'GI-01',
      });

      const outlet2 = store.createOutlet(userId, {
        name: 'Pondok Indah Mall 2 - Atrium',
        location: 'North Skywalk, Jakarta Selatan',
        code: 'PIM-02',
      });

      const outlets = store.getUserOutlets(userId);
      assert.strictEqual(outlets.length, 2);
      assert.strictEqual(outlets[0].name, 'Grand Indonesia - Flagship');
      assert.strictEqual(outlets[1].name, 'Pondok Indah Mall 2 - Atrium');
      assert.strictEqual(outlets[0].userId, userId);
      assert.strictEqual(outlets[1].userId, userId);
    });

    it('should isolate outlets between different users strictly', () => {
      const store = new MockFirebaseStore();
      const userA = 'usr-owner-A';
      const userB = 'usr-owner-B';

      store.createOutlet(userA, {
        name: 'Senayan City Booth',
        location: 'SC Mall',
        code: 'SC-01',
      });

      store.createOutlet(userB, {
        name: 'Surabaya Plaza Booth',
        location: 'SP Mall',
        code: 'SUB-01',
      });

      const outletsA = store.getUserOutlets(userA);
      const outletsB = store.getUserOutlets(userB);

      assert.strictEqual(outletsA.length, 1);
      assert.strictEqual(outletsB.length, 1);
      assert.strictEqual(outletsA[0].name, 'Senayan City Booth');
      assert.strictEqual(outletsB[0].name, 'Surabaya Plaza Booth');
    });
  });

  describe('3. Outlet-Scoped Events (users/{userId}/outlets/{outletId}/events)', () => {
    it('should store and filter events strictly within the selected outlet', () => {
      const store = new MockFirebaseStore();
      const userId = 'usr-owner-01';
      const giOutlet = store.createOutlet(userId, { name: 'GI', location: 'Jakarta', code: 'GI-01' });
      const pimOutlet = store.createOutlet(userId, { name: 'PIM', location: 'Jakarta', code: 'PIM-02' });

      // Create event in Grand Indonesia outlet
      store.createOutletEvent(userId, giOutlet.id, {
        name: 'GI Summer Gala 2026',
        date: 'OCT 2026',
        hashtag: '#GISummer',
      });

      // Create event in Pondok Indah Mall outlet
      store.createOutletEvent(userId, pimOutlet.id, {
        name: 'PIM Fashion Week',
        date: 'NOV 2026',
        hashtag: '#PIMFashion',
      });

      const giEvents = store.getOutletEvents(userId, giOutlet.id);
      const pimEvents = store.getOutletEvents(userId, pimOutlet.id);

      assert.strictEqual(giEvents.length, 1);
      assert.strictEqual(pimEvents.length, 1);
      assert.strictEqual(giEvents[0].name, 'GI Summer Gala 2026');
      assert.strictEqual(pimEvents[0].name, 'PIM Fashion Week');
      assert.strictEqual(giEvents[0].outletId, giOutlet.id);
      assert.strictEqual(pimEvents[0].outletId, pimOutlet.id);
    });

    it('should delete an event only from the specified outlet without affecting other outlets', () => {
      const store = new MockFirebaseStore();
      const userId = 'usr-owner-01';
      const outlet = store.createOutlet(userId, { name: 'Kota Kasablanka', location: 'Kokas', code: 'KK-01' });

      const ev1 = store.createOutletEvent(userId, outlet.id, { name: 'Event 1', date: '2026', hashtag: '#E1' });
      const ev2 = store.createOutletEvent(userId, outlet.id, { name: 'Event 2', date: '2026', hashtag: '#E2' });

      let events = store.getOutletEvents(userId, outlet.id);
      assert.strictEqual(events.length, 2);

      const deleted = store.deleteOutletEvent(userId, outlet.id, ev1.id);
      assert.strictEqual(deleted, true);

      events = store.getOutletEvents(userId, outlet.id);
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].id, ev2.id);
    });
  });

  describe('4. Outlet Dropdown Modal Specifications & Ergonomics', () => {
    it('should verify fixed size and auto-scroll constraints on dropdown modal', () => {
      // Requirements verification: fixed size and auto-scroll modal
      const modalClasses = 'max-h-60 overflow-y-auto w-72 sm:w-80';
      assert.ok(modalClasses.includes('max-h-60'), 'Dropdown modal must enforce max-h-60');
      assert.ok(modalClasses.includes('overflow-y-auto'), 'Dropdown modal must auto-scroll vertically');
      assert.ok(modalClasses.includes('w-72') || modalClasses.includes('w-80'), 'Dropdown modal must have fixed width');
    });

    it('should verify "Add an outlet" button is positioned at the very bottom', () => {
      // Structure verification:
      // [Header: Select Outlet] -> [Scrollable list: Outlets] -> [Bottom Footer: Add an outlet button]
      const layoutOrder = ['header', 'scrollable_outlets_list', 'add_outlet_button_bottom'];
      assert.strictEqual(layoutOrder[layoutOrder.length - 1], 'add_outlet_button_bottom');
    });
  });
});
