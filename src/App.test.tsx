import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the Rigor app shell with its tagline', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Rigor' })).toBeInTheDocument()
    expect(
      screen.getByText('Statistics that start with your experiment.'),
    ).toBeInTheDocument()
  })
})
