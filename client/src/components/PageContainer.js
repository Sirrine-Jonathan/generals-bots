import styled from 'styled-components'

const PageContainer = ({children}) => {
  return (
    <StyledPageContainer>
      {children}
    </StyledPageContainer>
  )
}

export default PageContainer;

const StyledPageContainer = styled.div`

`;