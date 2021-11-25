import styled from 'styled-components';

const Mosaic = ({children}) => {
  return (
    <StyledMosaic>
      {children}
    </StyledMosaic>
  )
}

export default Mosaic;

const StyledMosaic = styled.div`
  padding-top: 30px;
`;