import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export interface Outlet {
  id: string;
  userId: string;
  name: string;
  location: string;
  code: string;
  createdAt: number;
}

export function updateOutletRecord(
  outlets: Outlet[],
  outletId: string,
  data: Partial<Omit<Outlet, 'id' | 'userId' | 'createdAt'>>
): { updatedOutlets: Outlet[]; updatedRecord: Outlet | null } {
  const exists = outlets.some((o) => o.id === outletId);
  if (!exists) return { updatedOutlets: outlets, updatedRecord: null };

  const updatedOutlets = outlets.map((o) => (o.id === outletId ? { ...o, ...data } : o));
  const updatedRecord = updatedOutlets.find((o) => o.id === outletId) || null;
  return { updatedOutlets, updatedRecord };
}

export function deleteOutletRecord(
  outlets: Outlet[],
  outletId: string
): { success: boolean; remainingOutlets: Outlet[]; error?: string } {
  if (outlets.length <= 1) {
    return {
      success: false,
      remainingOutlets: outlets,
      error: 'Cannot delete the only remaining outlet. At least one outlet is required.',
    };
  }

  const remainingOutlets = outlets.filter((o) => o.id !== outletId);
  return { success: true, remainingOutlets };
}

describe('QuickPic Outlet Management & Persistence Test Suite', () => {
  const initialOutlets: Outlet[] = [
    {
      id: 'outlet-gi-01',
      userId: 'usr-demo-01',
      name: 'Grand Indonesia - Flagship',
      location: 'West Mall Level 3, Jakarta Pusat',
      code: 'GI-01',
      createdAt: 1700000000000,
    },
    {
      id: 'outlet-pim-02',
      userId: 'usr-demo-01',
      name: 'Pondok Indah Mall 2 - Atrium',
      location: 'North Skywalk 2nd Floor, Jakarta Selatan',
      code: 'PIM-02',
      createdAt: 1700000001000,
    },
    {
      id: 'outlet-sp-03',
      userId: 'usr-demo-01',
      name: 'Senayan City - Basement Zone',
      location: 'LG Floor Promenade, Jakarta Pusat',
      code: 'SC-03',
      createdAt: 1700000002000,
    },
  ];

  describe('Update Outlet Operations', () => {
    it('should successfully update outlet name and location', () => {
      const { updatedOutlets, updatedRecord } = updateOutletRecord(
        initialOutlets,
        'outlet-gi-01',
        {
          name: 'Grand Indonesia - East Skywalk',
          location: 'East Mall Level 5',
        }
      );

      assert.ok(updatedRecord);
      assert.strictEqual(updatedRecord.name, 'Grand Indonesia - East Skywalk');
      assert.strictEqual(updatedRecord.location, 'East Mall Level 5');
      assert.strictEqual(updatedRecord.code, 'GI-01'); // Code remains unchanged
      assert.strictEqual(updatedOutlets.length, 3);
    });

    it('should update branch code when provided', () => {
      const { updatedRecord } = updateOutletRecord(
        initialOutlets,
        'outlet-pim-02',
        { code: 'PIM-VIP' }
      );

      assert.ok(updatedRecord);
      assert.strictEqual(updatedRecord.code, 'PIM-VIP');
      assert.strictEqual(updatedRecord.name, 'Pondok Indah Mall 2 - Atrium');
    });

    it('should return null and not modify list when outlet ID is not found', () => {
      const { updatedOutlets, updatedRecord } = updateOutletRecord(
        initialOutlets,
        'non-existent-id',
        { name: 'Invalid' }
      );

      assert.strictEqual(updatedRecord, null);
      assert.deepStrictEqual(updatedOutlets, initialOutlets);
    });
  });

  describe('Delete Outlet Operations & Protection Guards', () => {
    it('should delete an outlet when multiple outlets exist', () => {
      const { success, remainingOutlets, error } = deleteOutletRecord(
        initialOutlets,
        'outlet-sp-03'
      );

      assert.strictEqual(success, true);
      assert.strictEqual(error, undefined);
      assert.strictEqual(remainingOutlets.length, 2);
      assert.ok(!remainingOutlets.some((o) => o.id === 'outlet-sp-03'));
    });

    it('should strictly block deletion if only 1 outlet remains in fleet', () => {
      const singleOutletList: Outlet[] = [initialOutlets[0]];
      const { success, remainingOutlets, error } = deleteOutletRecord(
        singleOutletList,
        'outlet-gi-01'
      );

      assert.strictEqual(success, false);
      assert.strictEqual(remainingOutlets.length, 1);
      assert.match(error || '', /Cannot delete the only remaining outlet/);
    });
  });
});
