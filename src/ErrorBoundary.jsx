import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error){ return { hasError: true, error } }
  componentDidCatch(error, info){ console.error('[PTLog] UI crash:', error, info) }
  render(){
    if (this.state.hasError){
      return (
        <div style={{padding:16,color:'#fff'}}>
          <h2>문제가 발생했어요</h2>
          <p style={{opacity:.8,fontSize:14}}>콘솔에 상세 로그를 남겼습니다.</p>
        </div>
      )
    }
    return this.props.children
  }
}
