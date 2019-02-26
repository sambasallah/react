


function MyComponent(props) {
  useEffect(() => {
    if (props.cond && props.onChange) {
      props.onChange();
    }
  }, []);
}