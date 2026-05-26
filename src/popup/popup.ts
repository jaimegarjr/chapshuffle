import { getShuffleEnabled, setShuffleEnabled } from '../persistence/PersistenceManager';

async function init(): Promise<void> {
  const toggle = document.getElementById('toggle') as HTMLInputElement;
  toggle.checked = await getShuffleEnabled();
  toggle.addEventListener('change', () => setShuffleEnabled(toggle.checked));
}

document.addEventListener('DOMContentLoaded', () => void init());
