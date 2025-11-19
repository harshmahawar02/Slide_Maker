import { render, screen } from '@testing-library/react';
import App from './App';

test('shows Share Point browser guidance by default', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: /share point/i })).toBeInTheDocument();
  expect(screen.getByText(/sharepoint decks at your fingertips/i)).toBeInTheDocument();
});
