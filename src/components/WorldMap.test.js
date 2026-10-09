import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import WorldMap, { unnamedRegionLabel } from '@/components/WorldMap';
import WorldMapPage from '@/components/WorldMapPage';
import { useGame } from '@/context/GameContext';
import * as firestore from 'firebase/firestore';

jest.mock('@/context/GameContext');
jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore');
jest.mock('lucide-react', () => ({ MapPin: () => <span data-testid="icon-map-pin" /> }));

const stamp = (ms) => ({ toMillis: () => ms });

// Region 45 (row 2, col 5) has an unread thread; region 46 a read one
const snaps = {
  names: { docs: [{ id: '46', data: () => ({ name: 'Thornwatch Ridge' }) }] },
  threads: {
    docs: [
      { id: 't1', data: () => ({ regionId: 45, status: 'approved', updatedAt: stamp(5000) }) },
      { id: 't2', data: () => ({ regionId: 46, status: 'approved', updatedAt: stamp(1000) }) },
      { id: 't3', data: () => ({ regionId: 46, status: 'approved', updatedAt: stamp(900) }) },
    ]
  }
};

describe('WorldMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGame.mockReturnValue({ user: { uid: 'u1' }, readReceipts: { t2: 2000, t3: 2000 } });
    firestore.collection.mockImplementation((_, ...path) => path[path.length - 1]);
    firestore.query.mockReturnValue('threads');
    firestore.onSnapshot.mockImplementation((ref, cb) => {
      cb(ref === 'region_metadata' ? snaps.names : snaps.threads);
      return jest.fn();
    });
  });

  test('labels unnamed regions by their 1-based grid index', () => {
    expect(unnamedRegionLabel(0)).toBe('Unnamed region 1');
    expect(unnamedRegionLabel(45)).toBe('Unnamed region 46');
  });

  test('renders the map image at the full width of its parent', () => {
    render(<WorldMap setView={jest.fn()} setActiveRegion={jest.fn()} />);
    const img = screen.getByAltText('World Map of Allania');
    expect(img).toHaveClass('w-full');
    expect(img.parentElement.style.aspectRatio).toBe('2816 / 1504');
  });

  test('region buttons describe their names and thread state', () => {
    render(<WorldMap setView={jest.fn()} setActiveRegion={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Thornwatch Ridge, 2 active threads' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unnamed region 46, unread posts' })).toBeInTheDocument();
    // Only playable regions are buttons: rows 2-11, columns 2-17
    expect(screen.getAllByRole('button')).toHaveLength(10 * 16);
  });

  test('clicking a region opens it', () => {
    const setView = jest.fn();
    const setActiveRegion = jest.fn();
    render(<WorldMap setView={setView} setActiveRegion={setActiveRegion} />);
    fireEvent.click(screen.getByRole('button', { name: /Thornwatch Ridge/ }));
    expect(setActiveRegion).toHaveBeenCalledWith({ id: 46, name: 'Thornwatch Ridge' });
    expect(setView).toHaveBeenCalledWith('region');
  });

  test('raises onRegionHover on enter and null when the pointer leaves the map', () => {
    const onRegionHover = jest.fn();
    const { container } = render(<WorldMap setView={jest.fn()} setActiveRegion={jest.fn()} onRegionHover={onRegionHover} />);

    fireEvent.mouseEnter(screen.getByRole('button', { name: /Thornwatch Ridge/ }));
    expect(onRegionHover).toHaveBeenLastCalledWith({ id: 46, name: 'Thornwatch Ridge', threadCount: 2, hasUnread: false });

    fireEvent.mouseEnter(screen.getByRole('button', { name: /Unnamed region 46/ }));
    expect(onRegionHover).toHaveBeenLastCalledWith({ id: 45, name: 'Unnamed region 46', threadCount: 1, hasUnread: true });

    fireEvent.mouseLeave(container.firstChild);
    expect(onRegionHover).toHaveBeenLastCalledWith(null);
  });

  test('guests never see unread markers', () => {
    useGame.mockReturnValue({ user: null, readReceipts: null });
    render(<WorldMap setView={jest.fn()} setActiveRegion={jest.fn()} />);
    expect(screen.queryByRole('button', { name: /unread posts/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unnamed region 46, 1 active thread' })).toBeInTheDocument();
  });
});

describe('WorldMapPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGame.mockReturnValue({ user: { uid: 'u1' }, readReceipts: { t2: 2000, t3: 2000 } });
    firestore.collection.mockImplementation((_, ...path) => path[path.length - 1]);
    firestore.query.mockReturnValue('threads');
    firestore.onSnapshot.mockImplementation((ref, cb) => {
      cb(ref === 'region_metadata' ? snaps.names : snaps.threads);
      return jest.fn();
    });
  });

  test('shows the title, the legend and a placeholder readout', () => {
    render(<WorldMapPage setView={jest.fn()} setActiveRegion={jest.fn()} onOpenLegal={jest.fn()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'The Realm of Allania' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Map legend' })).toHaveTextContent('Region with active threads');
    expect(screen.getByText('Hover over a region on the map')).toBeInTheDocument();
  });

  test('the readout follows the hovered region', () => {
    render(<WorldMapPage setView={jest.fn()} setActiveRegion={jest.fn()} onOpenLegal={jest.fn()} />);

    fireEvent.mouseEnter(screen.getByRole('button', { name: /Thornwatch Ridge/ }));
    expect(screen.getByText('2 active threads')).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole('button', { name: /Unnamed region 46/ }));
    expect(screen.getByText('Unread posts')).toBeInTheDocument();
    expect(screen.queryByText('2 active threads')).not.toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByAltText('World Map of Allania').parentElement);
    expect(screen.getByText('Hover over a region on the map')).toBeInTheDocument();
  });

  test('footer legal links open the matching LegalDocs tab', () => {
    const onOpenLegal = jest.fn();
    render(<WorldMapPage setView={jest.fn()} setActiveRegion={jest.fn()} onOpenLegal={onOpenLegal} />);
    fireEvent.click(screen.getByRole('button', { name: 'Privacy Policy' }));
    expect(onOpenLegal).toHaveBeenCalledWith('privacy');
  });
});
